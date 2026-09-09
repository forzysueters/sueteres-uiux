import { supabase } from '../lib/supabase'
import type { Json } from '../types/database'

/**
 * Motor de resposta do assistente operacional.
 *
 * As respostas são compostas exclusivamente a partir de dados reais do banco:
 * telemetria corrente, alertas abertos, saídas dos modelos de ML e trechos
 * recuperados da documentação técnica. Não há geração de texto por LLM neste
 * estágio — quando um provedor for conectado, este módulo passa a montar o
 * contexto (RAG) em vez de redigir a resposta final.
 */

interface AssetContext {
  asset: {
    tag: string
    name: string
    status: string
    location: string
    uptime: number
    anomaly_score: number
    last_maintenance: string | null
    next_maintenance: string | null
  } | null
  sensors: {
    name: string
    unit: string
    value: number | null
    status: string
    warning: number | null
    critical: number | null
  }[]
  active_alerts: {
    severity: string
    title: string
    message: string
    ml_insight: string | null
    triggered_at: string
  }[]
  predictions: {
    type: string
    value: number | null
    confidence: number | null
    rul_days: number | null
    recommended_action: string | null
    explanation: string | null
    model: string
  }[]
  open_maintenance: {
    order_number: string
    type: string
    status: string
    title: string
    scheduled_for: string | null
  }[]
}

const STATUS_LABELS: Record<string, string> = {
  normal: 'normal',
  warning: 'em alerta',
  critical: 'crítico',
  offline: 'offline',
}

const MAINTENANCE_LABELS: Record<string, string> = {
  preventive: 'preventiva',
  corrective: 'corretiva',
  predictive: 'preditiva',
  calibration: 'calibração',
  inspection: 'inspeção',
}

type AssetRef = { id: string; tag: string; name: string; status: string; anomaly_score: number; asset_type?: string }

const SUMMARY_MARKERS = /\b(resumo|resumir|panorama|visão geral|visao geral|status geral|situação geral|situacao geral)\b/i
const CATEGORY_MARKERS: Record<string, string[]> = {
  motor: ['motor', 'motores'],
  pump: ['bomba', 'bombas'],
  compressor: ['compressor', 'compressores'],
  fan: ['ventilador', 'ventiladores'],
}

function resolveCategory(question: string, assets: AssetRef[]): AssetRef[] {
  const q = question.toLowerCase()
  const category = Object.entries(CATEGORY_MARKERS).find(([, markers]) =>
    markers.some((marker) => q.includes(marker)),
  )?.[0]
  if (!category) return []
  return assets.filter((asset) => {
    if (asset.asset_type) return asset.asset_type === category
    return `${asset.tag} ${asset.name}`.toLowerCase().includes(CATEGORY_MARKERS[category][0])
  })
}

/** Resolve o ativo por id, por TAG citada na pergunta ou pelo nome. */
async function resolveAsset(question: string, assetContext: string | null): Promise<AssetRef | null> {
  const { data, error } = await supabase
    .from('v_assets_full')
    .select('id, tag, name, status, anomaly_score')

  if (error || !data) return null
  const assets = data as unknown as AssetRef[]

  if (assetContext) {
    const direct = assets.find((a) => a.id === assetContext || a.tag === assetContext)
    if (direct) return direct
  }

  const q = question.toLowerCase()
  const byTag = assets.find((a) => q.includes(a.tag.toLowerCase()))
  if (byTag) return byTag

  // Casa pelo nome mais específico primeiro, para "motor" não bater em qualquer motor.
  return (
    [...assets]
      .sort((a, b) => b.name.length - a.name.length)
      .find((a) => q.includes(a.name.toLowerCase())) ?? null
  )
}

function describeFleet(assets: AssetRef[]): string {
  if (assets.length === 0) return 'Nenhum ativo cadastrado nesta planta.'

  const critical = assets.filter((a) => a.status === 'critical')
  const warning = assets.filter((a) => a.status === 'warning')
  const offline = assets.filter((a) => a.status === 'offline')

  const lines = [`**Panorama da planta** — ${assets.length} ativos monitorados.`]

  if (critical.length > 0) {
    lines.push(
      `\n**Estado crítico (${critical.length}):** ` +
        critical.map((a) => `${a.tag} (${a.name})`).join('; '),
    )
  }
  if (warning.length > 0) {
    lines.push(`\n**Em alerta (${warning.length}):** ` + warning.map((a) => `${a.tag} (${a.name})`).join('; '))
  }
  if (offline.length > 0) {
    lines.push(`\n**Offline (${offline.length}):** ` + offline.map((a) => a.tag).join('; '))
  }
  if (critical.length === 0 && warning.length === 0 && offline.length === 0) {
    lines.push('\nTodos os ativos operam dentro dos parâmetros esperados.')
  }

  lines.push('\nPergunte por uma TAG específica (ex.: "situação do CMP-001") para o detalhamento.')
  return lines.join('')
}

function describeAsset(ctx: AssetContext): string {
  if (!ctx.asset) return ''

  const a = ctx.asset
  const lines: string[] = [
    `**${a.tag} — ${a.name}** · ${a.location}`,
    `Estado ${STATUS_LABELS[a.status] ?? a.status} · disponibilidade ${Number(a.uptime).toFixed(1)}% · índice de anomalia ${Number(a.anomaly_score).toFixed(1)}% (janela de 24 h).`,
  ]

  const abnormal = ctx.sensors.filter((s) => s.status !== 'normal')
  if (abnormal.length > 0) {
    lines.push(
      '\n**Sensores fora da faixa:**\n' +
        abnormal
          .map((s) => {
            const limit = s.status === 'critical' ? s.critical : s.warning
            const limitText = limit != null ? ` (limite ${limit})` : ''
            return `• ${s.name}: ${s.value ?? '—'} ${s.unit}${limitText}`
          })
          .join('\n'),
    )
  } else if (ctx.sensors.length > 0) {
    lines.push(`\nOs ${ctx.sensors.length} sensores do ativo estão dentro da faixa configurada.`)
  }

  if (ctx.active_alerts.length > 0) {
    lines.push(
      `\n**Alertas abertos (${ctx.active_alerts.length}):**\n` +
        ctx.active_alerts.map((al) => `• [${al.severity}] ${al.title} — ${al.message}`).join('\n'),
    )
    const insight = ctx.active_alerts.find((al) => al.ml_insight)?.ml_insight
    if (insight) lines.push(`\n**Análise do modelo:** ${insight}`)
  }

  const rul = ctx.predictions.find((p) => p.type === 'remaining_useful_life')
  if (rul?.rul_days != null) {
    const confidence = rul.confidence != null ? ` (confiança ${(rul.confidence * 100).toFixed(0)}%)` : ''
    lines.push(`\n**Vida útil remanescente estimada:** ${rul.rul_days} dias${confidence} — ${rul.model}.`)
    if (rul.recommended_action) lines.push(`**Ação recomendada:** ${rul.recommended_action}`)
  }

  if (ctx.open_maintenance.length > 0) {
    lines.push(
      '\n**Manutenção em aberto:**\n' +
        ctx.open_maintenance
          .map((m) => {
            const when = m.scheduled_for ? new Date(m.scheduled_for).toLocaleDateString('pt-BR') : 'sem data'
            return `• ${m.order_number} — ${MAINTENANCE_LABELS[m.type] ?? m.type}, ${when} (${m.title})`
          })
          .join('\n'),
    )
  }

  if (a.next_maintenance) {
    lines.push(`\nPróxima manutenção programada: ${new Date(a.next_maintenance).toLocaleDateString('pt-BR')}.`)
  }

  return lines.join('\n')
}

export interface AssistantAnswer {
  content: string
  citations: Json
  assetId: string | null
}

export async function answerQuestion(
  question: string,
  assetContext: string | null,
): Promise<AssistantAnswer> {
  const { data: assetRows } = await supabase
    .from('v_assets_full')
    .select('id, tag, name, status, anomaly_score, asset_type')
  const assets = (assetRows ?? []) as unknown as AssetRef[]
  const categoryAssets = resolveCategory(question, assets)
  const asset = categoryAssets.length > 0 ? null : await resolveAsset(question, assetContext)

  const [contextResult, categoryContexts, docsResult] = await Promise.all([
    asset
      ? supabase.rpc('get_asset_context', { p_asset_id: asset.id })
      : Promise.resolve({ data: null, error: null }),
    categoryAssets.length > 0
      ? Promise.all(categoryAssets.map((item) => supabase.rpc('get_asset_context', { p_asset_id: item.id })))
      : Promise.resolve([]),
    supabase.rpc('search_document_chunks', {
      p_query: question,
      p_asset_id: asset?.id ?? undefined,
      p_limit: 3,
    }),
  ])

  const docs = docsResult.error ? [] : (docsResult.data ?? [])
  const sections: string[] = []

  if (categoryAssets.length > 0 && SUMMARY_MARKERS.test(question)) {
    sections.push(
      `**Resumo dos ${categoryAssets.length} ativos encontrados:**`,
      ...categoryContexts.map((result, index) => {
        const current = result.error || !result.data ? null : (result.data as unknown as AssetContext)
        return current
          ? `\n${describeAsset(current)}`
          : `\n**${categoryAssets[index].tag} — ${categoryAssets[index].name}**: contexto indisponível.`
      }),
    )
  } else if (!contextResult.error && contextResult.data) {
    sections.push(describeAsset(contextResult.data as unknown as AssetContext))
  } else {
    sections.push(describeFleet(assets))
  }

  if (docs.length > 0) {
    sections.push(
      '\n---\n**Da documentação técnica:**\n' +
        docs
          .map((d) => {
            const page = d.page_number ? `, p. ${d.page_number}` : ''
            return `> ${d.content}\n— *${d.document_title}${page}*`
          })
          .join('\n\n'),
    )
  } else if (asset) {
    sections.push(
      '\n---\nNenhum trecho da documentação técnica corresponde a esta pergunta. ' +
        'A base indexada cobre manuais do fabricante e procedimentos internos.',
    )
  }

  const citations = docs.map((d) => ({
    chunk_id: d.id,
    document_id: d.document_id,
    document_title: d.document_title,
    page_number: d.page_number,
  })) as unknown as Json

  return {
    content: sections.filter(Boolean).join('\n'),
    citations,
    assetId: asset?.id ?? null,
  }
}
