// =============================================================================
// orion — núcleo de resposta do Órion, independente de canal
//
// O mesmo turno serve a tela (`ai-chat`) e o WhatsApp (`whatsapp-webhook`):
// conversa persistida, histórico reconstruído do banco, ativo em foco, RAG,
// modelo de linguagem e gravação dos dois lados. O canal só decide quem é o
// usuário, como o texto sai e um complemento de instrução de formato.
//
// Sem `Deno.*`: chaves e modelos entram por `LlmConfig`.
// =============================================================================

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
} from '../ai-chat/context.ts'

export interface LlmConfig {
  openaiKey?: string
  openaiModel: string
  geminiKey?: string
  geminiModel: string
}

export interface Turn {
  role: 'user' | 'assistant'
  text: string
}

export interface OrionRequest {
  userId: string
  question: string
  conversationId?: string | null
  assetContext?: string | null
  /** Instrução extra do canal (ex.: formato de WhatsApp). */
  channelPrompt?: string
}

export interface OrionAnswer {
  content: string
  citations: { chunk_id: string; document_id: string; document_title: string; page_number: number | null }[]
  assetId: string | null
  conversationId: string
}

export class OrionError extends Error {
  constructor(public code: string, public status: number, message?: string) {
    super(message ?? code)
  }
}

export const llmAvailable = (cfg: LlmConfig) => Boolean(cfg.openaiKey || cfg.geminiKey)
export const llmModelName = (cfg: LlmConfig) => (cfg.openaiKey ? cfg.openaiModel : cfg.geminiModel)

async function callOpenAI(cfg: LlmConfig, system: string, turns: Turn[]): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.openaiModel,
      messages: [{ role: 'system', content: system }, ...turns.map((t) => ({ role: t.role, content: t.text }))],
      temperature: 0.3,
      max_completion_tokens: 800,
    }),
  })
  if (!resp.ok) {
    console.error('[orion] OpenAI error:', resp.status, await resp.text())
    throw new Error(`openai_${resp.status}`)
  }
  const data = await resp.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGemini(cfg: LlmConfig, system: string, turns: Turn[]): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    },
  )
  if (!resp.ok) {
    console.error('[orion] Gemini error:', resp.status, await resp.text())
    throw new Error(`gemini_${resp.status}`)
  }
  const data = await resp.json()
  return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
}

export const callLlm = (cfg: LlmConfig, system: string, turns: Turn[]) =>
  cfg.openaiKey ? callOpenAI(cfg, system, turns) : callGemini(cfg, system, turns)

/**
 * Placa confirmada do ativo. `get_asset_context` não traz esse dado — sem isso
 * o assistente negava conhecer modelo/potência de ativos com placa cadastrada.
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

/**
 * Um turno completo do Órion. `supabase` pode ser o cliente com a JWT do
 * usuário (tela, RLS aplicada) ou o de serviço (WhatsApp, onde a identidade vem
 * do número vinculado e `userId` já foi resolvido pelo chamador).
 */
// deno-lint-ignore no-explicit-any
export async function answerOrion(supabase: any, cfg: LlmConfig, req: OrionRequest): Promise<OrionAnswer> {
  if (!llmAvailable(cfg)) throw new OrionError('llm_unavailable', 503, 'OPENAI_API_KEY não configurada no projeto Supabase.')

  const question = req.question.trim()
  if (!question) throw new OrionError('empty_question', 400)
  const startedAt = Date.now()

  // ─── Conversa: reaproveita a existente (do próprio usuário) ou cria uma nova
  let conversationId = req.conversationId ?? null
  if (conversationId) {
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!existing) conversationId = null
  }
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: req.userId, title: question.slice(0, 80) })
      .select('id')
      .single()
    if (error || !created) throw new OrionError('conversation_failed', 500)
    conversationId = created.id as string
  }

  // ─── Histórico reconstruído do banco, nunca do corpo da requisição: um
  //     histórico forjado plantaria turnos falsos do assistente. ────────────────
  let history: ChatTurn[] = []
  if (conversationId === req.conversationId) {
    const { data: past } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(24)
    history = ((past ?? []) as ChatTurn[]).reverse()
  }

  // ─── Ativo(s) em foco: pergunta > seleção na UI > histórico ─────────────────
  const { data: assetsData } = await supabase
    .from('v_assets_full')
    .select('id, tag, name, status, anomaly_score, health_index, criticality, uptime, active_alert_count')
  const assets = (assetsData ?? []) as unknown as AssetRef[]
  const { assets: focusAssets, source } = resolveFocusAssets(question, req.assetContext ?? null, history, assets)
  const singleAsset = focusAssets.length === 1 ? focusAssets[0] : null

  const searchQuery = buildSearchQuery(question, history)
  const [contexts, nameplates, docsResult] = await Promise.all([
    Promise.all(focusAssets.map((a) => supabase.rpc('get_asset_context', { p_asset_id: a.id }))),
    Promise.all(focusAssets.map((a) => fetchNameplate(supabase, a.id))),
    supabase.rpc('search_document_chunks', { p_query: searchQuery, p_asset_id: singleAsset?.id ?? undefined, p_limit: 6 }),
  ])

  const docs = filterRelevantDocs((docsResult.error ? [] : docsResult.data ?? []) as DocChunk[], 4)

  let assetSection: string
  if (focusAssets.length === 0) {
    assetSection = buildFleetContextText(assets)
  } else if (focusAssets.length === 1) {
    assetSection = contexts[0]?.data
      ? buildAssetContextText(contexts[0].data, source, nameplates[0])
      : buildFleetContextText(assets)
  } else {
    // deno-lint-ignore no-explicit-any
    assetSection = buildComparisonContextText(contexts.map((r: any, i: number) => ({ ctx: r.data, source, nameplate: nameplates[i] })))
  }

  const turns: Turn[] = [
    ...history.map((t) => ({ role: t.role, text: t.content })),
    { role: 'user', text: `${buildContextBlock({ assetSection, docs })}\n\nPergunta atual: ${question}` },
  ]
  const system = req.channelPrompt ? `${SYSTEM_PROMPT}\n\n${req.channelPrompt}` : SYSTEM_PROMPT

  let content: string
  try {
    content = await callLlm(cfg, system, turns)
  } catch (err) {
    console.error('[orion] erro ao chamar o modelo de linguagem:', err)
    throw new OrionError('llm_unavailable', 502, 'Falha ao consultar o modelo de linguagem.')
  }
  if (!content.trim()) throw new OrionError('llm_empty_response', 502)

  const citations = filterCitedDocs(docs, content).map((d) => ({
    chunk_id: d.id,
    document_id: d.document_id,
    document_title: d.document_title,
    page_number: d.page_number,
  }))

  // As duas linhas com EXATAMENTE as mesmas chaves: o PostgREST recusa o lote
  // inteiro (PGRST102) se uma tiver campo que a outra não tem.
  const { error: insertError } = await supabase.from('chat_messages').insert([
    { conversation_id: conversationId, role: 'user', content: question, asset_context: singleAsset?.id ?? null, citations: [], model: null, latency_ms: null },
    { conversation_id: conversationId, role: 'assistant', content, asset_context: singleAsset?.id ?? null, citations, model: llmModelName(cfg), latency_ms: Date.now() - startedAt },
  ])
  if (insertError) console.error('[orion] falha ao gravar o turno:', insertError)

  return { content, citations, assetId: singleAsset?.id ?? null, conversationId }
}
