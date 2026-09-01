// =============================================================================
// ai-chat — Assistente conversacional Forzy (Edge Function, Deno)
//
// Recebe a pergunta do usuário + histórico da conversa, monta o contexto real
// do site (telemetria, alertas, predições, manutenção, trechos de documentação
// via RAG lexical) e delega a geração da resposta em linguagem natural ao
// Gemini. A chave da API nunca chega ao front-end: fica em `GEMINI_API_KEY`,
// um secret do projeto Supabase.
//
// Roda com a JWT do usuário autenticado (repassada pelo supabase-js), então
// toda leitura/escrita respeita a Row Level Security já definida nas
// migrações — a function não usa a service role key.
//
// A lógica de resolução de ativo, busca RAG e montagem do contexto vive em
// `./context.ts` (módulo puro, sem `Deno.*`) para poder ser testada com
// vitest/tsx fora do runtime da Edge Function.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  AssetRef,
  ChatTurn,
  DocChunk,
  Nameplate,
  SYSTEM_PROMPT,
  resolveFocusAssets,
  buildSearchQuery,
  filterRelevantDocs,
  filterCitedDocs,
  buildFleetContextText,
  buildAssetContextText,
  buildComparisonContextText,
  buildContextBlock,
} from './context.ts'

// `gemini-2.0-flash` foi desativado pela Google (erro 404 em produção,
// verificado ao vivo em 2026-08); `gemini-3.6-flash` é o substituto atual.
// Ajustável sem deploy de código via o secret `GEMINI_MODEL` no projeto.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface RequestBody {
  question: string
  assetContext?: string | null
  conversationId?: string | null
  history?: ChatTurn[]
}

/**
 * Placa de identificação confirmada do ativo (manufacturer, modelo, potência,
 * tensão etc.). `get_asset_context` não traz esse dado — sem isso, o
 * assistente negava conhecer o modelo/potência de ativos que já têm placa
 * cadastrada (bug real encontrado em auditoria, verificado contra o banco).
 */
// deno-lint-ignore no-explicit-any
async function fetchNameplate(supabase: any, assetId: string): Promise<Nameplate | null> {
  const { data } = await supabase
    .from('asset_nameplates')
    .select('manufacturer, model, serial_number, motor_type, year_manufactured, power_kw, power_hp, voltage, current_a, rpm, poles, frequency_hz, connection_type, insulation_class, ip_rating, efficiency_class')
    .eq('asset_id', assetId)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Nameplate | null) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  if (!GEMINI_API_KEY) {
    return json({ error: 'llm_unavailable', message: 'GEMINI_API_KEY não configurada no projeto Supabase.' }, 503)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const question = (body.question ?? '').trim()
  if (!question) return json({ error: 'empty_question' }, 400)
  const history = Array.isArray(body.history) ? body.history.slice(-12) : []

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  const startedAt = Date.now()

  // ─── Conversa: reaproveita a existente ou cria uma nova ───────────────────
  let conversationId = body.conversationId ?? null
  if (conversationId) {
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle()
    if (!existing) conversationId = null
  }
  if (!conversationId) {
    const { data: created, error: createError } = await supabase
      .from('chat_conversations')
      .insert({ user_id: userId, title: question.slice(0, 80) })
      .select('id')
      .single()
    if (createError || !created) return json({ error: 'conversation_failed' }, 500)
    conversationId = created.id
  }

  // ─── Ativo(s) em foco: menção(ões) na pergunta > seleção na UI > último turno
  //     do histórico que mencionou algum ativo. Pode ser mais de um (comparação) —
  //     a memória não fica presa a "o último ativo": relemos o histórico em vez de
  //     depender de uma única coluna, então "compare A e B" seguido de "qual dos
  //     dois..." recupera A e B de novo, não só o que apareceu por último.
  const { data: assetsData } = await supabase.from('v_assets_full').select('id, tag, name, status, anomaly_score')
  const assets = (assetsData ?? []) as unknown as AssetRef[]
  const { assets: focusAssets, source: assetSource } = resolveFocusAssets(
    question,
    body.assetContext ?? null,
    history,
    assets,
  )
  const singleAsset = focusAssets.length === 1 ? focusAssets[0] : null

  // ─── Contexto do(s) ativo(s) + RAG (a busca é enriquecida com o turno anterior
  //     quando a pergunta atual é curta ou anafórica: "nesse caso", "e esse?").
  //     RAG só é restrito a um ativo específico quando há exatamente um em foco —
  //     com 0 ou vários, busca na base de documentação como um todo. ───────────
  const searchQuery = buildSearchQuery(question, history)
  const [assetContextResults, nameplates, docsResult] = await Promise.all([
    Promise.all(focusAssets.map((a) => supabase.rpc('get_asset_context', { p_asset_id: a.id }))),
    Promise.all(focusAssets.map((a) => fetchNameplate(supabase, a.id))),
    supabase.rpc('search_document_chunks', { p_query: searchQuery, p_asset_id: singleAsset?.id ?? undefined, p_limit: 6 }),
  ])

  const rawDocs = (docsResult.error ? [] : docsResult.data ?? []) as DocChunk[]
  const docs = filterRelevantDocs(rawDocs, 4)

  let assetSection: string
  if (focusAssets.length === 0) {
    assetSection = buildFleetContextText(assets)
  } else if (focusAssets.length === 1) {
    assetSection = assetContextResults[0]?.data
      ? buildAssetContextText(assetContextResults[0].data, assetSource, nameplates[0])
      : buildFleetContextText(assets)
  } else {
    assetSection = buildComparisonContextText(
      assetContextResults.map((r, i) => ({ ctx: r.data, source: assetSource, nameplate: nameplates[i] })),
    )
  }

  const contextBlock = buildContextBlock({ assetSection, docs })

  // ─── Monta a conversa para o Gemini: histórico + turno atual com contexto ─
  const contents = [
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: [{ text: `${contextBlock}\n\nPergunta atual: ${question}` }] },
  ]

  let answerText: string
  try {
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      },
    )
    if (!geminiResp.ok) {
      const errText = await geminiResp.text()
      console.error('[ai-chat] Gemini error:', geminiResp.status, errText)
      return json({ error: 'llm_unavailable', message: 'Falha ao consultar o modelo de linguagem.' }, 502)
    }
    const geminiJson = await geminiResp.json()
    answerText = geminiJson.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    if (!answerText.trim()) {
      return json({ error: 'llm_empty_response' }, 502)
    }
  } catch (err) {
    console.error('[ai-chat] erro ao chamar Gemini:', err)
    return json({ error: 'llm_unavailable' }, 502)
  }

  const latencyMs = Date.now() - startedAt

  // Só vira citação o que o modelo realmente referenciou na resposta (título
  // do documento aparece no texto) — evita citar um chunk que só passou perto
  // na busca mas não sustentou nada.
  const citedDocs = filterCitedDocs(docs, answerText)
  const citations = citedDocs.map((d) => ({
    chunk_id: d.id,
    document_id: d.document_id,
    document_title: d.document_title,
    page_number: d.page_number,
  }))

  // ─── Persiste os dois lados do turno ───────────────────────────────────
  await supabase.from('chat_messages').insert([
    { conversation_id: conversationId, role: 'user', content: question, asset_context: singleAsset?.id ?? null },
    {
      conversation_id: conversationId,
      role: 'assistant',
      content: answerText,
      asset_context: singleAsset?.id ?? null,
      citations,
      model: GEMINI_MODEL,
      latency_ms: latencyMs,
    },
  ])

  return json({
    content: answerText,
    citations,
    assetId: singleAsset?.id ?? null,
    conversationId,
  })
})
