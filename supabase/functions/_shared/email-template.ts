// =============================================================================
// email-template — HTML dos e-mails transacionais (módulo puro)
//
// Por que não reaproveitar `src/components/AssetReport.tsx`: aquele documento é
// Tailwind + `@media print`. Gmail, Outlook e Apple Mail descartam folha de
// estilo externa e classes — o A4 chegaria sem nenhum estilo. E-mail exige
// tabela + estilo inline, então o layout é outro; o que se reaproveita são os
// dados e as convenções (glifo por estado, média 2h, tabular-nums).
//
// Sem `Deno.*` aqui de propósito: o módulo é testável fora do runtime da Edge
// Function, do mesmo jeito que `ai-chat/context.ts`.
// =============================================================================

export type Language = 'pt' | 'en'
export type StatusKey = 'normal' | 'warning' | 'critical' | 'offline' | 'info'

/**
 * Forma distinta por estado — mesma decisão do relatório A4: crítico (#d03b3b) e
 * normal (#0ca30c) ficam a ΔE 4.1 em deuteranopia e viram o mesmo cinza quando
 * o e-mail é impresso. A cor nunca carrega o estado sozinha.
 */
const GLYPH: Record<StatusKey, string> = {
  normal: '●',
  warning: '▲',
  critical: '■',
  offline: '○',
  info: '◆',
}

const STATUS_COLOR: Record<StatusKey, string> = {
  normal: '#0f7b0f',
  warning: '#b45309',
  critical: '#c02626',
  offline: '#6b7280',
  info: '#1d4ed8',
}

const C = {
  page: '#f3f4f6',
  card: '#ffffff',
  ink: '#16181d',
  soft: '#4b5563',
  muted: '#6b7280',
  line: '#e5e7eb',
  brand: '#ea580c',
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Escapa texto vindo do banco (descrição, nome do ativo) antes de virar HTML. */
export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const T = {
  pt: {
    scheduled_title: 'Manutenção agendada',
    scheduled_lead: 'Sua solicitação foi registrada e a ordem de manutenção já está aberta.',
    assigned_title: 'Nova manutenção designada para você',
    assigned_lead: 'Uma ordem de manutenção foi aberta e atribuída a você.',
    order: 'Ordem',
    asset: 'Ativo',
    type: 'Tipo',
    priority: 'Prioridade',
    when: 'Data e hora',
    technician: 'Técnico responsável',
    requested_by: 'Solicitado por',
    location: 'Local',
    description: 'Descrição',
    no_description: 'Sem descrição adicional.',
    report_title: 'Relatório do ativo',
    report_lead: 'Situação do ativo no momento em que o relatório foi gerado.',
    health: 'Índice de saúde',
    insight: 'Análise preditiva',
    telemetry: 'Telemetria',
    sensor: 'Sensor',
    reading: 'Leitura',
    mean2h: 'Média 2h',
    limit: 'Limite',
    state: 'Estado',
    alerts: 'Alertas ativos',
    no_alerts: 'Nenhum alerta ativo no momento.',
    maintenance: 'Manutenção',
    last: 'Última',
    next: 'Próxima',
    attached_pdf: 'O relatório completo em A4 segue anexo neste e-mail.',
    generated_at: 'Gerado em',
    footer: 'Forzy — Gêmeo Digital Industrial. Mensagem automática, não responda.',
    none: '—',
    status: { normal: 'Normal', warning: 'Atenção', critical: 'Crítico', offline: 'Offline', info: 'Info' },
    types: {
      preventive: 'Preventiva', corrective: 'Corretiva', predictive: 'Preditiva',
      inspection: 'Inspeção', calibration: 'Calibração',
    },
    priorities: { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' },
  },
  en: {
    scheduled_title: 'Maintenance scheduled',
    scheduled_lead: 'Your request was recorded and the work order is now open.',
    assigned_title: 'New maintenance assigned to you',
    assigned_lead: 'A work order has been opened and assigned to you.',
    order: 'Order',
    asset: 'Asset',
    type: 'Type',
    priority: 'Priority',
    when: 'Date and time',
    technician: 'Assigned technician',
    requested_by: 'Requested by',
    location: 'Location',
    description: 'Description',
    no_description: 'No additional description.',
    report_title: 'Asset report',
    report_lead: 'Asset condition at the moment this report was generated.',
    health: 'Health index',
    insight: 'Predictive analysis',
    telemetry: 'Telemetry',
    sensor: 'Sensor',
    reading: 'Reading',
    mean2h: '2h average',
    limit: 'Limit',
    state: 'State',
    alerts: 'Active alerts',
    no_alerts: 'No active alerts right now.',
    maintenance: 'Maintenance',
    last: 'Last',
    next: 'Next',
    attached_pdf: 'The full A4 report is attached to this email.',
    generated_at: 'Generated at',
    footer: 'Forzy — Industrial Digital Twin. Automated message, do not reply.',
    none: '—',
    status: { normal: 'Normal', warning: 'Warning', critical: 'Critical', offline: 'Offline', info: 'Info' },
    types: {
      preventive: 'Preventive', corrective: 'Corrective', predictive: 'Predictive',
      inspection: 'Inspection', calibration: 'Calibration',
    },
    priorities: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
  },
} as const

const dict = (lang: Language) => T[lang] ?? T.pt

const LOCALE: Record<Language, string> = { pt: 'pt-BR', en: 'en-US' }
/** Fuso da planta. Sem isso o horário do agendamento sai em UTC no e-mail. */
const TZ = 'America/Sao_Paulo'

export const formatDateTime = (iso: string | null | undefined, lang: Language): string => {
  if (!iso) return dict(lang).none
  const d = new Date(iso)
  if (isNaN(d.getTime())) return dict(lang).none
  return d.toLocaleString(LOCALE[lang], {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })
}

export const formatDate = (iso: string | null | undefined, lang: Language): string => {
  if (!iso) return dict(lang).none
  const d = new Date(iso)
  if (isNaN(d.getTime())) return dict(lang).none
  return d.toLocaleDateString(LOCALE[lang], {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ,
  })
}

// ─────────────────────────── blocos reutilizáveis ───────────────────────────

const pill = (status: StatusKey, label: string) => `
  <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;
    color:${STATUS_COLOR[status]};background:${STATUS_COLOR[status]}14;border:1px solid ${STATUS_COLOR[status]}40;">
    <span style="font-size:11px;">${GLYPH[status]}</span>&nbsp;${esc(label)}
  </span>`

const row = (label: string, value: string) => `
  <tr>
    <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:13px;color:${C.muted};width:38%;
      vertical-align:top;font-family:${FONT};">${esc(label)}</td>
    <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:13px;color:${C.ink};font-weight:600;
      vertical-align:top;font-family:${FONT};">${value}</td>
  </tr>`

const sectionTitle = (text: string) => `
  <p style="margin:26px 0 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    color:${C.muted};font-family:${FONT};">${esc(text)}</p>`

/** Casca comum: fundo, cartão central de 600px e rodapé. */
const layout = (opts: { title: string; lead: string; body: string; lang: Language }) => `<!doctype html>
<html lang="${opts.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.lead)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
        <tr><td style="padding:20px 28px;border-bottom:3px solid ${C.brand};">
          <span style="font-size:15px;font-weight:800;color:${C.ink};letter-spacing:-.02em;font-family:${FONT};">Forzy</span>
          <span style="font-size:12px;color:${C.muted};font-family:${FONT};">&nbsp;·&nbsp;${esc(opts.title)}</span>
        </td></tr>
        <tr><td style="padding:24px 28px 30px;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${C.soft};font-family:${FONT};">${esc(opts.lead)}</p>
          ${opts.body}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid ${C.line};">
          <p style="margin:0;font-size:11px;color:${C.muted};font-family:${FONT};">${esc(dict(opts.lang).footer)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

// ─────────────────────────── e-mail de agendamento ──────────────────────────

export interface MaintenanceEmailData {
  orderNumber: string
  assetTag: string
  assetName: string
  location?: string | null
  type: string
  priority: string
  scheduledFor: string
  technicianName: string
  requesterName: string
  description?: string | null
}

const PRIORITY_STATUS: Record<string, StatusKey> = {
  low: 'normal', medium: 'info', high: 'warning', critical: 'critical',
}

export function maintenanceEmail(
  data: MaintenanceEmailData,
  lang: Language,
  variant: 'requester' | 'technician',
): { subject: string; html: string } {
  const t = dict(lang)
  const isTech = variant === 'technician'
  const title = isTech ? t.assigned_title : t.scheduled_title
  const lead = isTech ? t.assigned_lead : t.scheduled_lead

  const typeLabel = (t.types as Record<string, string>)[data.type] ?? data.type
  const priorityLabel = (t.priorities as Record<string, string>)[data.priority] ?? data.priority

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:${C.brand}0f;border:1px solid ${C.brand}33;border-radius:10px;margin-bottom:6px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
          color:${C.muted};font-family:${FONT};">${esc(t.order)}</p>
        <p style="margin:0;font-size:22px;font-weight:800;color:${C.ink};font-family:${FONT};
          font-variant-numeric:tabular-nums;">${esc(data.orderNumber)}</p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row(t.asset, `${esc(data.assetTag)} — ${esc(data.assetName)}`)}
      ${row(t.when, esc(formatDateTime(data.scheduledFor, lang)))}
      ${row(t.type, esc(typeLabel))}
      ${row(t.priority, pill(PRIORITY_STATUS[data.priority] ?? 'info', priorityLabel))}
      ${row(isTech ? t.requested_by : t.technician, esc(isTech ? data.requesterName : data.technicianName))}
      ${data.location ? row(t.location, esc(data.location)) : ''}
      ${row(t.description, esc(data.description || t.no_description))}
    </table>`

  return {
    subject: `${title} · ${data.orderNumber} · ${data.assetTag}`,
    html: layout({ title, lead, body, lang }),
  }
}

// ─────────────────────────── e-mail de relatório ────────────────────────────

export interface ReportSensor {
  name: string
  value: number
  unit: string
  threshold?: number | null
  mean2h?: number | null
  status: StatusKey
}

export interface ReportAlert {
  title: string
  message: string
  severity: StatusKey
  triggeredAt: string
}

export interface AssetReportEmailData {
  assetTag: string
  assetName: string
  location?: string | null
  status: StatusKey
  /** Rótulo pronto; sem ele o estado é nomeado pelo dicionário do idioma. */
  statusLabel?: string
  healthIndex: number
  insight?: string | null
  sensors: ReportSensor[]
  alerts: ReportAlert[]
  lastMaintenance?: string | null
  nextMaintenance?: string | null
  generatedAt: string
  hasPdf: boolean
}

const num = (v: number | null | undefined, unit = '', fallback = '—') =>
  v == null || !isFinite(v) ? fallback : `${Number(v).toFixed(1)}${unit ? `&nbsp;${esc(unit)}` : ''}`

/** Seta de tendência em tinta neutra: é direção, não estado. Banda morta de ±2%
 *  porque sem ela o ruído de leitura viraria seta o tempo todo. */
const trend = (value: number, mean: number | null | undefined) => {
  if (mean == null || !isFinite(mean) || mean === 0) return ''
  const delta = (value - mean) / Math.abs(mean)
  if (Math.abs(delta) < 0.02) return `<span style="color:${C.muted};">=</span>`
  return `<span style="color:${C.muted};">${delta > 0 ? '▲' : '▼'}</span>`
}

export function assetReportEmail(
  data: AssetReportEmailData,
  lang: Language,
): { subject: string; html: string } {
  const t = dict(lang)
  const healthStatus: StatusKey =
    data.healthIndex < 45 ? 'critical' : data.healthIndex < 65 ? 'warning' : data.healthIndex < 85 ? 'info' : 'normal'

  const th = (text: string, align: 'left' | 'right' = 'left') => `
    <th style="padding:8px 6px;text-align:${align};font-size:11px;font-weight:700;letter-spacing:.05em;
      text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.line};font-family:${FONT};">${esc(text)}</th>`

  const td = (html: string, align: 'left' | 'right' = 'left', mono = false) => `
    <td style="padding:9px 6px;text-align:${align};font-size:12px;color:${C.ink};border-bottom:1px solid ${C.line};
      font-family:${FONT};${mono ? 'font-variant-numeric:tabular-nums;' : ''}">${html}</td>`

  const sensorRows = data.sensors.length
    ? data.sensors.map((s) => `
      <tr>
        ${td(esc(s.name))}
        ${td(`${num(s.value, s.unit)} ${trend(s.value, s.mean2h)}`, 'right', true)}
        ${td(num(s.mean2h, s.unit), 'right', true)}
        ${td(num(s.threshold, s.unit), 'right', true)}
        ${td(pill(s.status, (t.status as Record<string, string>)[s.status] ?? s.status))}
      </tr>`).join('')
    : `<tr>${td(`<span style="color:${C.muted};">${esc(t.none)}</span>`)}</tr>`

  const alertsBlock = data.alerts.length
    ? data.alerts.map((a) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid ${C.line};border-left:3px solid ${STATUS_COLOR[a.severity]};border-radius:8px;margin-bottom:8px;">
        <tr><td style="padding:11px 13px;font-family:${FONT};">
          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:${C.ink};">
            <span style="color:${STATUS_COLOR[a.severity]};">${GLYPH[a.severity]}</span>&nbsp;${esc(a.title)}</p>
          <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:${C.soft};">${esc(a.message)}</p>
          <p style="margin:0;font-size:11px;color:${C.muted};">${esc(formatDateTime(a.triggeredAt, lang))}</p>
        </td></tr>
      </table>`).join('')
    : `<p style="margin:0;font-size:13px;color:${C.muted};font-family:${FONT};">${esc(t.no_alerts)}</p>`

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid ${C.line};border-radius:10px;margin-bottom:4px;">
      <tr>
        <td style="padding:16px 18px;font-family:${FONT};">
          <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
            color:${C.muted};">${esc(t.health)}</p>
          <p style="margin:0;font-size:34px;font-weight:800;color:${STATUS_COLOR[healthStatus]};line-height:1.1;">
            ${Math.round(data.healthIndex)}<span style="font-size:16px;color:${C.muted};font-weight:700;">/100</span></p>
        </td>
        <td align="right" style="padding:16px 18px;font-family:${FONT};">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${C.ink};">${esc(data.assetTag)}</p>
          <p style="margin:0 0 8px;font-size:12px;color:${C.muted};">${esc(data.assetName)}</p>
          ${pill(data.status, data.statusLabel ?? (t.status as Record<string, string>)[data.status] ?? data.status)}
        </td>
      </tr>
    </table>

    ${data.insight ? `
      ${sectionTitle(t.insight)}
      <p style="margin:0;padding:12px 14px;background:#fafafa;border:1px solid ${C.line};border-radius:8px;
        font-size:13px;line-height:1.6;color:${C.soft};font-family:${FONT};">${esc(data.insight)}</p>` : ''}

    ${sectionTitle(t.telemetry)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>${th(t.sensor)}${th(t.reading, 'right')}${th(t.mean2h, 'right')}${th(t.limit, 'right')}${th(t.state)}</tr>
      ${sensorRows}
    </table>

    ${sectionTitle(t.alerts)}
    ${alertsBlock}

    ${sectionTitle(t.maintenance)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row(t.last, esc(formatDate(data.lastMaintenance, lang)))}
      ${row(t.next, esc(formatDate(data.nextMaintenance, lang)))}
      ${data.location ? row(t.location, esc(data.location)) : ''}
    </table>

    ${data.hasPdf ? `
      <p style="margin:22px 0 0;padding:11px 14px;background:${C.brand}0f;border:1px solid ${C.brand}33;
        border-radius:8px;font-size:12px;color:${C.soft};font-family:${FONT};">${esc(t.attached_pdf)}</p>` : ''}

    <p style="margin:20px 0 0;font-size:11px;color:${C.muted};font-family:${FONT};">
      ${esc(t.generated_at)} ${esc(formatDateTime(data.generatedAt, lang))}</p>`

  return {
    subject: `${t.report_title} · ${data.assetTag} · ${Math.round(data.healthIndex)}/100`,
    html: layout({ title: t.report_title, lead: t.report_lead, body, lang }),
  }
}
