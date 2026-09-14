// =============================================================================
// whatsapp-webhook — o Órion atendendo pelo WhatsApp (Edge Function, Deno)
//
//   GET  → handshake de verificação da Meta (hub.challenge)
//   POST → mensagem recebida: valida assinatura, identifica o usuário pelo
//          número vinculado, responde com o mesmo núcleo do chat da tela.
//
// Identidade: não há JWT no WhatsApp. O número só vale se estiver em
// `profiles.whatsapp_phone` com `whatsapp_opt_in` e conta ativa (migração
// 0024). Por isso roda com a service role — a checagem de quem pode perguntar
// acontece aqui, antes de qualquer leitura.
//
// A Meta reenvia o webhook se não receber 200 em poucos segundos, e o LLM leva
// mais que isso. A resposta sai na hora e o processamento segue em
// `EdgeRuntime.waitUntil`; `whatsapp_inbound_log` descarta reenvio duplicado.
//
// Deploy (a function não usa JWT do Supabase — a Meta não manda):
//   supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
//     WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=...
//   supabase functions deploy whatsapp-webhook --no-verify-jwt
// Callback no painel da Meta: https://<ref>.supabase.co/functions/v1/whatsapp-webhook
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { answerOrion, llmAvailable, OrionError, type LlmConfig } from '../_shared/orion.ts'
import {
  isWhatsAppConfigured,
  markAsRead,
  normalizePhone,
  parseInbound,
  sendText,
  verifySignature,
  verifySubscription,
  type InboundMessage,
  type WhatsAppConfig,
} from '../_shared/whatsapp.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const WA: Partial<WhatsAppConfig> = {
  accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: Deno.env.get('WHATSAPP_APP_SECRET'),
  verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN'),
  graphVersion: Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v21.0',
}
const LLM: LlmConfig = {
  openaiKey: Deno.env.get('OPENAI_API_KEY'),
  openaiModel: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.4-mini',
  geminiKey: Deno.env.get('GEMINI_API_KEY'),
  geminiModel: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? ''

/** Conversa do WhatsApp continua a mesma enquanto houver troca nas últimas 12 h. */
const CONVERSATION_IDLE_MS = 12 * 60 * 60 * 1000

const CHANNEL_PROMPT = `## Canal atual: WhatsApp
Você está respondendo pelo WhatsApp, no celular de quem está na planta.
- Respostas curtas: no máximo 3 parágrafos curtos ou 6 tópicos.
- Nada de tabela markdown nem título; use *negrito* com um asterisco e listas com "•".
- Quem lê não está com a tela aberta: em vez de "clique em", diga o que a pessoa encontra no Forzy e onde.
- Se a pergunta exigir análise longa, dê o essencial e sugira abrir o cockpit do ativo no Forzy.`

const HELP_TEXT = `Oi! Eu sou o *Órion*, o assistente da planta no Forzy.
Pode me perguntar em texto, por exemplo:
• Como está o CMP-001?
• Quais ativos estão críticos agora?
• Qual a temperatura do MTR-002?

Comandos: *ajuda* · *parar* (desliga os avisos por WhatsApp)`

const COMMANDS = {
  help: /^(ajuda|help|menu|oi|olá|ola)$/i,
  stop: /^(parar|sair|stop|cancelar avisos)$/i,
}

// deno-lint-ignore no-explicit-any
type Db = any

async function handleMessage(db: Db, cfg: WhatsAppConfig, msg: InboundMessage) {
  const phone = normalizePhone(msg.from)
  if (!phone) return

  // Idempotência: a Meta reenvia o mesmo `id` se o 200 atrasar.
  const { data: fresh } = await db
    .from('whatsapp_inbound_log')
    .insert({ message_id: msg.id, phone, message_type: msg.type })
    .select('message_id')
    .maybeSingle()
  if (!fresh) return

  const finish = (status: string, detail?: string) =>
    db.from('whatsapp_inbound_log')
      .update({ status, detail: detail ?? null, processed_at: new Date().toISOString() })
      .eq('message_id', msg.id)

  await markAsRead(cfg, msg.id)

  const { data: profile } = await db
    .from('profiles')
    .select('id, full_name, is_active, whatsapp_opt_in')
    .eq('whatsapp_phone', phone)
    .maybeSingle()

  if (!profile || !profile.is_active) {
    await sendText(cfg, msg.from,
      'Este número não está vinculado a um usuário ativo do Forzy. ' +
      `Peça ao administrador para cadastrar seu WhatsApp no seu perfil${APP_URL ? ` (${APP_URL}/conta)` : ''}.`)
    await finish('unknown_sender')
    return
  }

  const text = (msg.text ?? '').trim()

  if (COMMANDS.stop.test(text)) {
    await db.from('profiles').update({ whatsapp_opt_in: false }).eq('id', profile.id)
    await db.from('user_settings').update({ notify_whatsapp: false }).eq('user_id', profile.id)
    await sendText(cfg, msg.from, 'Pronto, os avisos do Órion por WhatsApp foram desligados. Para reativar, use a tela Conta no Forzy.')
    await finish('opt_out')
    return
  }

  // Mensagem recebida reabre a janela de 24 h da Meta — é o que libera texto livre
  // nos avisos de alerta (ver orion-notify).
  const { data: session } = await db
    .from('whatsapp_sessions')
    .select('conversation_id, last_inbound_at')
    .eq('phone', phone)
    .maybeSingle()
  const idle = !session?.last_inbound_at || Date.now() - new Date(session.last_inbound_at).getTime() > CONVERSATION_IDLE_MS
  await db.from('whatsapp_sessions').upsert({
    phone,
    profile_id: profile.id,
    conversation_id: idle ? null : session?.conversation_id ?? null,
    last_inbound_at: new Date().toISOString(),
  })

  if (COMMANDS.help.test(text)) {
    await sendText(cfg, msg.from, HELP_TEXT)
    await finish('help')
    return
  }

  if (msg.type === 'audio' || !text) {
    await sendText(cfg, msg.from, 'Por enquanto eu entendo só mensagens de texto por aqui. Pode escrever a sua pergunta?')
    await finish('unsupported_type', msg.type)
    return
  }

  if (!llmAvailable(LLM)) {
    await sendText(cfg, msg.from, 'O Órion está sem acesso ao modelo de linguagem no momento. Tente de novo em alguns minutos.')
    await finish('llm_unavailable')
    return
  }

  try {
    const answer = await answerOrion(db, LLM, {
      userId: profile.id,
      question: text,
      conversationId: idle ? null : session?.conversation_id ?? null,
      channelPrompt: CHANNEL_PROMPT,
    })
    await db.from('whatsapp_sessions').update({ conversation_id: answer.conversationId }).eq('phone', phone)
    const sent = await sendText(cfg, msg.from, answer.content)
    await finish(sent.ok ? 'answered' : 'send_failed', sent.ok ? undefined : sent.error)
  } catch (err) {
    const code = err instanceof OrionError ? err.code : 'internal_error'
    console.error('[whatsapp-webhook]', code, err)
    await sendText(cfg, msg.from, 'Não consegui responder agora. Tente de novo em instantes.')
    await finish('error', code)
  }
}

Deno.serve(async (req) => {
  if (!isWhatsAppConfigured(WA)) return new Response('whatsapp_not_configured', { status: 503 })
  const cfg = WA

  if (req.method === 'GET') {
    const challenge = verifySubscription(new URL(req.url), cfg.verifyToken)
    return challenge ? new Response(challenge, { status: 200 }) : new Response('forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const raw = await req.text()
  if (!(await verifySignature(raw, req.headers.get('X-Hub-Signature-256'), cfg.appSecret))) {
    return new Response('invalid_signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('invalid_body', { status: 400 })
  }

  const messages = parseInbound(payload)
  if (messages.length) {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const work = Promise.all(messages.map((m) => handleMessage(db, cfg, m)))
      .catch((err) => console.error('[whatsapp-webhook] falha no processamento', err))
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
    else await work
  }

  return new Response('ok', { status: 200 })
})
