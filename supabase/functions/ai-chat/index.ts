// =============================================================================
// ai-chat — Assistente conversacional Forzy na tela (Edge Function, Deno)
//
// Recebe a pergunta do usuário e delega o turno a `_shared/orion.ts`, que monta
// o contexto real do site (telemetria, alertas, predições, manutenção, RAG
// lexical) e consulta o GPT (OpenAI). O mesmo núcleo atende o WhatsApp.
//
// O provedor é escolhido por presença de secret: `OPENAI_API_KEY` manda; sem
// ela, a function ainda atende pelo Gemini se `GEMINI_API_KEY` existir.
//
// Roda com a JWT do usuário autenticado (repassada pelo supabase-js), então
// toda leitura/escrita respeita a Row Level Security — sem service role.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { answerOrion, llmAvailable, OrionError, type LlmConfig } from '../_shared/orion.ts'

const LLM: LlmConfig = {
  openaiKey: Deno.env.get('OPENAI_API_KEY'),
  openaiModel: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.4-mini',
  geminiKey: Deno.env.get('GEMINI_API_KEY'),
  // `gemini-2.0-flash` foi desativado pela Google (404 em produção, 2026-08).
  geminiModel: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Origens do front que podem chamar esta function — secret `ALLOWED_ORIGINS`
// (separadas por vírgula). `*` até o secret ser definido.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeadersFor(origin: string | null) {
  const allowOrigin =
    ALLOWED_ORIGINS.includes('*') ? '*' : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

interface RequestBody {
  question: string
  assetContext?: string | null
  conversationId?: string | null
}

Deno.serve(async (req) => {
  // Por requisição, nunca num `let` de módulo: sob concorrência misturaria origens.
  const cors = corsHeadersFor(req.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  if (!llmAvailable(LLM)) {
    return json({ error: 'llm_unavailable', message: 'OPENAI_API_KEY não configurada no projeto Supabase.' }, 503)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const question = (body.question ?? '').trim()
  if (!question) return json({ error: 'empty_question' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  try {
    const answer = await answerOrion(supabase, LLM, {
      userId: userData.user.id,
      question,
      conversationId: body.conversationId ?? null,
      assetContext: body.assetContext ?? null,
    })
    return json(answer)
  } catch (err) {
    if (err instanceof OrionError) return json({ error: err.code, message: err.message }, err.status)
    console.error('[ai-chat] erro inesperado:', err)
    return json({ error: 'internal_error' }, 500)
  }
})
