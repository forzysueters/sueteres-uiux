#!/usr/bin/env node
/**
 * Verificação ponta a ponta do modelo de acesso.
 *
 * Entra com cada conta de demonstração usando a MESMA chave publishable do
 * frontend e confere o que cada papel consegue (e não consegue) fazer. É o que
 * garante que a RLS está de fato barrando, e não só a interface escondendo.
 *
 * Uso: node scripts/verify-access.mjs
 * Requer VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.
 *
 * Efeito colateral: resolve e restaura um alerta durante o teste. Rode
 * `npm run db:seed` depois se quiser o conjunto exatamente como veio.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = (m[2] ?? '').replace(/^['"]|['"]$/g, '')
    }
  }
}
loadEnv()

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const PW = process.env.DEMO_PASSWORD || 'password123'

if (!URL || !KEY) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.')
  process.exit(1)
}

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FALHOU ${name} ${detail}`) }
}

const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function login(email) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { c, user: data.user }
}

// ─── Anônimo ────────────────────────────────────────────────────────────────
console.log('\n[sem sessão]')
{
  const c = client()
  const assets = await c.from('v_assets_full').select('id')
  check('não lê ativos', (assets.data ?? []).length === 0)
  const alerts = await c.from('alerts').select('id')
  check('não lê alertas', (alerts.data ?? []).length === 0)
}

// ─── Técnico ────────────────────────────────────────────────────────────────
console.log('\n[technician — opera alertas e cadastra equipamento]')
let restoreAlertId = null
{
  const { c } = await login('technician@industrial.com')

  const assets = await c.from('v_assets_full').select('*')
  check('lê os ativos', (assets.data?.length ?? 0) === 5, `(${assets.data?.length})`)

  const mtr1 = assets.data?.find((a) => a.tag === 'MTR-001')
  check('ativo traz sensores aninhados', Array.isArray(mtr1?.sensors) && mtr1.sensors.length === 5)
  check('sensor traz leitura corrente', mtr1?.sensors?.[0]?.value != null)
  check('ativo traz a placa de dados', mtr1?.nameplate?.manufacturer === 'WEG')
  check('ativo traz coordenadas da planta', mtr1?.plant_x === 20 && mtr1?.plant_y === 25)

  const rpm = await c.from('sensors').select('limit_direction').eq('tag', 'MTR-001.RPM').single()
  check('limite com direção "below" na rotação', rpm.data?.limit_direction === 'below')

  const kpi = await c.from('v_kpi_metrics').select('*').single()
  check('lê indicadores', kpi.data?.total_assets === 5)

  const alerts = await c.from('v_alerts_full').select('*').order('triggered_at', { ascending: false })
  check('lê alertas', (alerts.data?.length ?? 0) >= 3, `(${alerts.data?.length})`)
  check('todo alerta aponta um sensor', (alerts.data ?? []).every((a) => a.sensor_id != null))

  const series = await c.rpc('get_asset_series', { p_asset_id: mtr1.id, p_hours: 24, p_bucket_minutes: 15 })
  check('série temporal do ativo', (series.data?.length ?? 0) > 0)

  const ctx = await c.rpc('get_asset_context', { p_asset_id: mtr1.id })
  check('contexto operacional do ativo', ctx.data?.asset?.tag === 'MTR-001')

  const docs = await c.rpc('search_document_chunks', { p_query: 'vibração rolamento', p_limit: 3 })
  check('busca na documentação', (docs.data?.length ?? 0) > 0)

  const preds = await c.from('v_asset_latest_prediction').select('*').eq('asset_id', mtr1.id)
  check('predições de ML', (preds.data?.length ?? 0) >= 2)

  const om = await c
    .from('maintenance_orders')
    .select('id, order_number, assets(name), profiles!maintenance_orders_assigned_to_fkey(full_name)')
  check('ordens de manutenção com relações', (om.data?.length ?? 0) >= 5 && !!om.data?.[0]?.assets)

  const target = alerts.data.find((a) => a.status !== 'resolved')
  restoreAlertId = target?.id
  const resolved = await c.rpc('resolve_alert', { p_alert_id: target.id })
  check('resolve alerta', !resolved.error, JSON.stringify(resolved.error))

  const after = await c.from('alerts').select('status, resolved, resolved_by').eq('id', target.id).single()
  check('transição carimbada pelo trigger', after.data?.resolved === true && after.data?.resolved_by != null)

  const insertAsset = await c
    .from('assets')
    .insert({ plant_id: mtr1.plant_id, tag: 'X-999', name: 'x', location: 'y' })
  check('NÃO cria ativo (RLS)', !!insertAsset.error, `(${insertAsset.error?.code})`)

  await c.auth.signOut()
}

// ─── Visualizador ───────────────────────────────────────────────────────────
console.log('\n[viewer — somente leitura]')
{
  const { c } = await login('viewer@industrial.com')

  const assets = await c.from('v_assets_full').select('id')
  check('lê ativos', assets.data?.length === 5)

  const active = await c.from('v_alerts_full').select('id, status').neq('status', 'resolved').limit(1)
  if (active.data?.[0]) {
    const id = active.data[0].id
    await c.rpc('resolve_alert', { p_alert_id: id })
    const still = await c.from('alerts').select('status').eq('id', id).single()
    check('NÃO resolve alerta (RLS)', still.data?.status !== 'resolved', `(virou ${still.data?.status})`)
  }

  const np = await c.from('asset_nameplates').insert({ manufacturer: 'x', model: 'y' })
  check('NÃO cadastra equipamento (RLS)', !!np.error, `(${np.error?.code})`)

  await c.auth.signOut()
}

// ─── Admin ──────────────────────────────────────────────────────────────────
console.log('\n[admin — governança]')
{
  const { c } = await login('admin@industrial.com')

  const audit = await c.from('audit_logs').select('id, action, entity_type').limit(5)
  check('lê a trilha de auditoria', (audit.data?.length ?? 0) > 0)

  const profiles = await c.from('profiles').select('email, role')
  check('lê todos os perfis', (profiles.data?.length ?? 0) >= 4)

  const settings = await c.from('user_settings').select('user_id')
  check('preferências seguem pessoais mesmo para admin', settings.data?.length === 1)

  if (restoreAlertId) {
    await c.from('alerts').update({ status: 'active', resolution_notes: null }).eq('id', restoreAlertId)
  }

  await c.auth.signOut()
}

// ─── Isolamento de conversas ────────────────────────────────────────────────
console.log('\n[conversas do assistente]')
{
  const a = await login('engineer@industrial.com')
  const conv = await a.c
    .from('chat_conversations')
    .insert({ user_id: a.user.id, title: 'verificação de isolamento' })
    .select('id')
    .single()
  check('engenheiro cria conversa', !conv.error, JSON.stringify(conv.error))

  const b = await login('technician@industrial.com')
  const seen = await b.c.from('chat_conversations').select('id').eq('id', conv.data.id)
  check('técnico NÃO vê conversa alheia', (seen.data ?? []).length === 0)

  await a.c.from('chat_conversations').delete().eq('id', conv.data.id)
  await a.c.auth.signOut()
  await b.c.auth.signOut()
}

console.log(`\n${pass} passaram, ${fail} falharam`)
process.exit(fail ? 1 : 0)
