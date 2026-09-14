// =============================================================================
// orion-notify — o Órion avisa sobre alertas por e-mail e WhatsApp
//
// Dispatcher da fila `orion_notifications` (migração 0024). O trigger em
// `alerts` enfileira uma linha por destinatário e canal, respeitando as
// preferências de `user_settings`; o `pg_cron` chama esta function a cada
// minuto (quando `orion_notify_config.enabled`) e ela entrega o lote.
//
// Nada de destinatário vindo de fora: e-mail e telefone saem de `profiles`,
// resolvidos no banco. A chamada exige `x-orion-secret`, então a URL pública
// não vira gatilho de spam.
//
// WhatsApp segue a regra das 24 h da Meta: dentro da janela (o usuário falou
// com o Órion recentemente) vai texto livre com o insight; fora dela, só o
// template aprovado `WHATSAPP_ALERT_TEMPLATE`.
//
// Deploy:
//   supabase secrets set ORION_NOTIFY_SECRET=... APP_URL=https://forzy.app
//   supabase functions deploy orion-notify --no-verify-jwt
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { isConfigured as emailConfigured, sendEmail } from '../_shared/brevo.ts'
import { alertEmail, type Language } from '../_shared/email-template.ts'
import {
  insideServiceWindow,
  isWhatsAppConfigured,
  sendTemplate,
  sendText,
  type WhatsAppConfig,
} from '../_shared/whatsapp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const NOTIFY_SECRET = Deno.env.get('ORION_NOTIFY_SECRET')
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
const BATCH = Number(Deno.env.get('ORION_NOTIFY_BATCH') ?? '25')

const WA: Partial<WhatsAppConfig> = {
  accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: Deno.env.get('WHATSAPP_APP_SECRET'),
  verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN'),
  graphVersion: Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v21.0',
}
const TEMPLATE_NAME = Deno.env.get('WHATSAPP_ALERT_TEMPLATE') ?? 'forzy_alerta_ativo'
const TEMPLATE_LANG = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') ?? 'pt_BR'

/** Linha devolvida por `claim_orion_notifications`. */
interface Job {
  id: number
  channel: 'email' | 'whatsapp'
  attempts: number
  alert_id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  ml_insight: string | null
  triggered_at: string
  asset_id: string
  asset_tag: string
  asset_name: string
  asset_location: string | null
  health_index: number | null
  asset_insight: string | null
  profile_email: string
  profile_name: string | null
  whatsapp_phone: string | null
  language: string | null
  last_inbound_at: string | null
}

type Outcome = { ok: true; providerId: string | null } | { ok: false; error: string; retry: boolean }

const SEVERITY_PT: Record<Job['severity'], string> = { info: 'Informativo', warning: 'Atenção', critical: 'CRÍTICO' }

async function deliverEmail(job: Job): Promise<Outcome> {
  if (!emailConfigured()) return { ok: false, error: 'email_not_configured', retry: false }
  const lang: Language = job.language === 'en' ? 'en' : 'pt'
  const { subject, html } = alertEmail({
    assetId: job.asset_id,
    assetTag: job.asset_tag,
    assetName: job.asset_name,
    location: job.asset_location,
    severity: job.severity,
    title: job.title,
    message: job.message,
    insight: job.ml_insight ?? job.asset_insight,
    healthIndex: job.health_index,
    triggeredAt: job.triggered_at,
    appUrl: APP_URL || null,
  }, lang)
  const r = await sendEmail({ to: { email: job.profile_email, name: job.profile_name ?? undefined }, subject, html })
  return r.ok ? { ok: true, providerId: r.messageId } : { ok: false, error: r.error, retry: true }
}

async function deliverWhatsApp(job: Job): Promise<Outcome> {
  if (!isWhatsAppConfigured(WA)) return { ok: false, error: 'whatsapp_not_configured', retry: false }
  if (!job.whatsapp_phone) return { ok: false, error: 'no_phone', retry: false }

  const link = APP_URL ? `${APP_URL}/planta/ativo/${job.asset_id}` : ''
  const insight = job.ml_insight ?? job.asset_insight

  const r = insideServiceWindow(job.last_inbound_at)
    ? await sendText(WA, job.whatsapp_phone, [
        `*${SEVERITY_PT[job.severity]} · ${job.asset_tag}* — ${job.asset_name}`,
        job.title,
        job.message,
        insight ? `_Órion:_ ${insight}` : '',
        job.health_index != null ? `Saúde: ${Math.round(job.health_index)}/100` : '',
        link,
        'Responda aqui para perguntar mais sobre este ativo.',
      ].filter(Boolean).join('\n\n'))
    // Template no WhatsApp Manager, categoria "Utility", corpo com 4 variáveis:
    // "{{1}} no ativo {{2}}: {{3}}. {{4}}" e botão de URL `${APP_URL}/planta/ativo/{{1}}`.
    : await sendTemplate(WA, job.whatsapp_phone, {
        name: TEMPLATE_NAME,
        language: TEMPLATE_LANG,
        params: [SEVERITY_PT[job.severity], `${job.asset_tag} (${job.asset_name})`, job.title, insight ?? job.message],
        buttonUrlSuffix: APP_URL ? job.asset_id : undefined,
      })

  if (r.ok) return { ok: true, providerId: r.messageId }
  // 131026 = número sem WhatsApp; 131047 = fora da janela sem template; não adianta repetir.
  const permanent = /_(131026|131047|132001)$/.test(r.error)
  return { ok: false, error: r.error, retry: !permanent }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  if (!NOTIFY_SECRET || req.headers.get('x-orion-secret') !== NOTIFY_SECRET) {
    return new Response('forbidden', { status: 403 })
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: jobs, error } = await db.rpc('claim_orion_notifications', { p_limit: BATCH })
  if (error) {
    console.error('[orion-notify] claim', error.message)
    return new Response(JSON.stringify({ error: 'claim_failed' }), { status: 502 })
  }

  const results = await Promise.all(((jobs ?? []) as Job[]).map(async (job) => {
    const outcome = job.channel === 'email' ? await deliverEmail(job) : await deliverWhatsApp(job)
    await db.rpc('complete_orion_notification', {
      p_id: job.id,
      p_ok: outcome.ok,
      p_provider_id: outcome.ok ? outcome.providerId : null,
      p_error: outcome.ok ? null : outcome.error,
      p_retry: outcome.ok ? false : outcome.retry,
    })
    return { id: job.id, channel: job.channel, ok: outcome.ok }
  }))

  return new Response(JSON.stringify({
    processed: results.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  }), { headers: { 'Content-Type': 'application/json' } })
})
