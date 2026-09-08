// =============================================================================
// send-asset-report — relatório do ativo por e-mail (Edge Function, Deno)
//
// O corpo do e-mail é montado AQUI, a partir do banco — não do HTML que o
// cliente mandaria. Aceitar markup do front para reenviar seria relay aberto:
// qualquer usuário logado despacharia conteúdo arbitrário assinado pelo
// domínio. O PDF anexo vem do cliente (é o A4 renderizado pelo navegador), mas
// é apenas transportado, com teto de tamanho.
//
// O destinatário também não vem do cliente: é sempre o e-mail do próprio
// usuário autenticado, resolvido em `profiles` pelo `auth.uid()`.
//
// Roda com a JWT do usuário, então a leitura respeita a RLS das migrações.
//
// Deploy:
//   supabase secrets set BREVO_API_KEY=xkeysib-... BREVO_SENDER_EMAIL=voce@dominio.com
//   supabase functions deploy send-asset-report
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { isConfigured, sendEmail, type Attachment } from '../_shared/brevo.ts'
import {
  assetReportEmail,
  type Language,
  type ReportAlert,
  type ReportSensor,
  type StatusKey,
} from '../_shared/email-template.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

/** Teto do anexo em base64. O limite do Brevo é o tamanho total da mensagem
 *  (~10 MB); 7 MB de base64 ≈ 5 MB de PDF deixa folga para o corpo. */
const MAX_PDF_BASE64 = 7_000_000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const SENSOR_STATUS: Record<string, StatusKey> = {
  normal: 'normal',
  warning: 'warning',
  critical: 'critical',
  offline: 'offline',
}

/** severity do modelo (ok/info/alerta/critico) → estado do relatório. */
const SEVERITY_STATUS: Record<string, StatusKey> = {
  ok: 'normal',
  info: 'info',
  alerta: 'warning',
  critico: 'critical',
}

interface RawSensor {
  name: string
  unit: string
  value: number | null
  status: string
  warning_threshold: number | null
  critical_threshold: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'missing_authorization' }, 401)

  if (!isConfigured()) return json({ error: 'email_not_configured' }, 503)

  let assetId: string
  let language: Language
  let pdfBase64: string | null
  try {
    const body = await req.json()
    assetId = String(body?.assetId ?? '').trim()
    language = body?.language === 'en' ? 'en' : 'pt'
    // O front pode mandar com o prefixo `data:`; o Brevo quer só o base64.
    pdfBase64 = body?.pdfBase64 ? String(body.pdfBase64).replace(/^data:[^,]+,/, '') : null
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  if (!assetId) return json({ error: 'missing_asset_id' }, 400)
  if (pdfBase64 && pdfBase64.length > MAX_PDF_BASE64) return json({ error: 'pdf_too_large' }, 413)
  if (pdfBase64 && !/^[A-Za-z0-9+/=\s]+$/.test(pdfBase64)) return json({ error: 'invalid_pdf' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthenticated' }, 401)

  const [{ data: profile }, { data: asset, error: assetError }, { data: alerts }, { data: series }] =
    await Promise.all([
      supabase.from('profiles').select('email, full_name').eq('id', auth.user.id).maybeSingle(),
      supabase.from('v_assets_full').select('*').eq('id', assetId).maybeSingle(),
      supabase
        .from('v_alerts_full')
        .select('title, message, severity, triggered_at')
        .eq('asset_id', assetId)
        .eq('resolved', false)
        .order('triggered_at', { ascending: false })
        .limit(10),
      // Mesma janela fixa de 2h do relatório A4 (ver AssetMonitorPage): a média
      // não pode seguir a faixa que o usuário escolheu no gráfico, senão muda de
      // significado sem avisar.
      supabase.rpc('get_asset_series', { p_asset_id: assetId, p_hours: 2, p_bucket_minutes: 5 }),
    ])

  if (assetError) {
    console.error('[send-asset-report] leitura do ativo', assetError.message)
    return json({ error: 'asset_lookup_failed' }, 502)
  }
  if (!asset) return json({ error: 'asset_not_found' }, 404)

  const recipient = profile?.email as string | undefined
  if (!recipient) return json({ error: 'no_recipient' }, 422)

  // Média das últimas 2h por sensor — o valor instantâneo não distingue pico de patamar.
  const sums = new Map<string, { total: number; count: number }>()
  for (const row of (series ?? []) as { sensor_name: string; avg_value: number | null }[]) {
    if (row.avg_value == null || !isFinite(row.avg_value)) continue
    const acc = sums.get(row.sensor_name) ?? { total: 0, count: 0 }
    acc.total += row.avg_value
    acc.count += 1
    sums.set(row.sensor_name, acc)
  }
  const meanOf = (name: string) => {
    const acc = sums.get(name)
    return acc && acc.count > 0 ? acc.total / acc.count : null
  }

  const rawSensors = (Array.isArray(asset.sensors) ? asset.sensors : []) as RawSensor[]
  const sensors: ReportSensor[] = rawSensors.map((s) => ({
    name: s.name,
    value: s.value ?? 0,
    unit: s.unit,
    threshold: s.warning_threshold ?? s.critical_threshold ?? null,
    mean2h: meanOf(s.name),
    status: SENSOR_STATUS[s.status] ?? 'info',
  }))

  const reportAlerts: ReportAlert[] = ((alerts ?? []) as {
    title: string
    message: string
    severity: string
    triggered_at: string
  }[]).map((a) => ({
    title: a.title,
    message: a.message,
    severity: SENSOR_STATUS[a.severity] ?? 'info',
    triggeredAt: a.triggered_at,
  }))

  const healthIndex =
    asset.health_index != null ? Number(asset.health_index) : 100 - Number(asset.anomaly_score ?? 0)
  const assetStatus = SENSOR_STATUS[asset.status as string] ?? 'info'
  const severityStatus = SEVERITY_STATUS[asset.severity as string] ?? assetStatus

  const { subject, html } = assetReportEmail(
    {
      assetTag: asset.tag as string,
      assetName: asset.name as string,
      location: (asset.location as string) ?? null,
      status: severityStatus,
      healthIndex,
      insight: (asset.insight as string) ?? null,
      sensors,
      alerts: reportAlerts,
      lastMaintenance: (asset.last_maintenance as string) ?? null,
      nextMaintenance: (asset.next_maintenance as string) ?? null,
      generatedAt: new Date().toISOString(),
      hasPdf: Boolean(pdfBase64),
    },
    language,
  )

  const attachments: Attachment[] | undefined = pdfBase64
    ? [{ name: `${asset.tag}-relatorio.pdf`, content: pdfBase64.replace(/\s/g, '') }]
    : undefined

  const result = await sendEmail({
    to: { email: recipient, name: (profile?.full_name as string) ?? undefined },
    subject,
    html,
    attachments,
  })

  if (!result.ok) return json({ error: result.error }, 502)
  return json({ sent: [recipient], attached: Boolean(pdfBase64) })
})
