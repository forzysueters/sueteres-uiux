// =============================================================================
// send-maintenance-email — confirmação de agendamento (Edge Function, Deno)
//
// Chamada logo após o INSERT em `public.maintenance_orders` (ver
// `apiService.createMaintenanceOrder`). Envia dois e-mails com textos
// diferentes: confirmação para quem agendou e aviso de OM designada para o
// técnico.
//
// Recebe apenas o `orderId`. Nada de destinatário vindo do cliente: os e-mails
// saem de `profiles`, resolvidos aqui dentro. Aceitar endereço do front
// transformaria a function em relay aberto — qualquer usuário logado mandaria
// e-mail em nome do domínio para quem quisesse.
//
// Roda com a JWT do usuário (repassada pelo supabase-js), então a leitura da OM
// e dos perfis respeita a RLS das migrações: `maintenance_select` exige
// `can_read()`, e `profiles_select` libera o perfil alheio para quem já lê.
//
// Deploy:
//   supabase secrets set BREVO_API_KEY=xkeysib-... BREVO_SENDER_EMAIL=voce@dominio.com
//   supabase functions deploy send-maintenance-email
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { isConfigured, sendAll, type EmailMessage } from '../_shared/brevo.ts'
import { maintenanceEmail, type Language } from '../_shared/email-template.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'missing_authorization' }, 401)

  if (!isConfigured()) return json({ error: 'email_not_configured' }, 503)

  let orderId: string
  let language: Language
  try {
    const body = await req.json()
    orderId = String(body?.orderId ?? '').trim()
    language = body?.language === 'en' ? 'en' : 'pt'
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  if (!orderId) return json({ error: 'missing_order_id' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })

  const { data: order, error: orderError } = await supabase
    .from('maintenance_orders')
    .select(
      'order_number, maintenance_type, priority, scheduled_for, description, assigned_to, created_by,' +
        ' assets ( tag, name, location )',
    )
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    console.error('[send-maintenance-email] leitura da OM', orderError.message)
    return json({ error: 'order_lookup_failed' }, 502)
  }
  if (!order) return json({ error: 'order_not_found' }, 404)

  // Os dois perfis numa consulta só; `in` evita ida e volta dupla.
  const profileIds = [order.created_by, order.assigned_to].filter(Boolean) as string[]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', profileIds)

  const byId = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.id as string, p as ProfileRow]))
  const requester = order.created_by ? byId.get(order.created_by) : undefined
  const technician = order.assigned_to ? byId.get(order.assigned_to) : undefined

  const asset = (Array.isArray(order.assets) ? order.assets[0] : order.assets) as
    | { tag: string; name: string; location: string | null }
    | null

  const data = {
    orderNumber: order.order_number as string,
    assetTag: asset?.tag ?? '—',
    assetName: asset?.name ?? '—',
    location: asset?.location ?? null,
    type: order.maintenance_type as string,
    priority: order.priority as string,
    scheduledFor: order.scheduled_for as string,
    technicianName: technician?.full_name || technician?.email || '—',
    requesterName: requester?.full_name || requester?.email || '—',
    description: (order.description as string | null) ?? null,
  }

  const messages: EmailMessage[] = []

  if (requester?.email) {
    const { subject, html } = maintenanceEmail(data, language, 'requester')
    messages.push({
      to: { email: requester.email, name: requester.full_name ?? undefined },
      subject,
      html,
    })
  }

  // Quem agenda a própria OM não precisa de duas cópias da mesma informação.
  if (technician?.email && technician.email !== requester?.email) {
    const { subject, html } = maintenanceEmail(data, language, 'technician')
    messages.push({
      to: { email: technician.email, name: technician.full_name ?? undefined },
      subject,
      html,
    })
  }

  if (messages.length === 0) return json({ sent: [], failed: [], warning: 'no_recipients' })

  const results = await sendAll(messages)

  return json({
    sent: results.filter((r) => r.ok).map((r) => r.to),
    failed: results.filter((r) => !r.ok).map((r) => ({ to: r.to, error: (r as { error: string }).error })),
  })
})
