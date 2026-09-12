#!/usr/bin/env node
/**
 * Verificação ponta a ponta do modelo de acesso (RBAC de três papéis, 0016).
 *
 * Entra com cada conta usando a MESMA chave publishable do frontend e confere o
 * que cada papel consegue — e, sobretudo, o que NÃO consegue. É o que garante
 * que a RLS está barrando de verdade, e não só a interface escondendo.
 *
 * Fala com o PostgREST por `fetch` puro, sem `@supabase/supabase-js`: aquele
 * pacote exige WebSocket nativo (Node 22+) só para construir o cliente, e
 * quebrava aqui antes de rodar um único teste. Sem ele, roda em qualquer Node
 * com fetch (18+).
 *
 * Uso:      node scripts/verify-access.mjs
 * Requer:   VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env
 * Ajustes:  DEMO_PASSWORD, DEMO_ADMIN, DEMO_ENGINEER, DEMO_TECHNICIAN
 *
 * Efeito colateral: resolve um alerta e o restaura ao final.
 */
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

const URL_BASE = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const PW = process.env.DEMO_PASSWORD

/**
 * Candidatos por papel: o que estiver na env primeiro, depois a conta que o
 * `create-demo-users.mjs` provisiona. Entra com o primeiro que aceitar a senha.
 *
 * Estes sao os mesmos enderecos usados no login E guardados em `profiles`: os
 * dois campos foram sincronizados, entao a tela de Usuarios mostra exatamente
 * o e-mail com que a pessoa entra.
 */
const ACCOUNTS = {
  admin: [process.env.DEMO_ADMIN, 'admin@industrial.com'],
  engineer: [process.env.DEMO_ENGINEER, 'engineer@industrial.com'],
  technician: [process.env.DEMO_TECHNICIAN, 'technician@industrial.com'],
}

if (!URL_BASE || !KEY || !PW) {
  console.error('Defina VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e DEMO_PASSWORD no .env.local.')
  process.exit(1)
}

let pass = 0
let fail = 0
let skipped = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok     ${name}`) }
  else { fail++; console.log(`  FALHOU ${name} ${detail}`) }
}

// ─── Cliente PostgREST mínimo ───────────────────────────────────────────────

async function login(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${email}: ${body.error_description || body.msg || res.status}`)
  return { token: body.access_token, id: body.user?.id }
}

/**
 * Uma requisição ao PostgREST. Devolve `{ status, rows, error }`.
 *
 * `Prefer: return=representation` é o que torna possível distinguir "a RLS
 * recusou" de "deu certo": uma escrita barrada não devolve erro, devolve LISTA
 * VAZIA. É a mesma armadilha que o `updateAssetLayout` e o `resolve_alert`
 * enfrentam no app.
 */
async function rest(token, pathname, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...(method !== 'GET' ? { Prefer: prefer || 'return=representation' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let parsed = null
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }

  if (!res.ok) {
    return { status: res.status, rows: [], error: parsed || { message: text } }
  }
  return { status: res.status, rows: Array.isArray(parsed) ? parsed : parsed ? [parsed] : [], error: null }
}

const rpc = (token, fn, args) =>
  rest(token, `rpc/${fn}`, { method: 'POST', body: args, prefer: 'return=representation' })

// ─── Execução ───────────────────────────────────────────────────────────────

const tokens = {}
const emails = {}
const ids = {}
for (const [role, candidates] of Object.entries(ACCOUNTS)) {
  let lastError = ''
  for (const email of candidates.filter(Boolean)) {
    try {
      const session = await login(email)
      tokens[role] = session.token
      ids[role] = session.id
      emails[role] = email
      break
    } catch (err) {
      lastError = err.message
    }
  }
  if (!tokens[role]) {
    console.log(`\nAVISO  nao entrou como ${role}: ${lastError}`)
    console.log(`   Tentados: ${candidates.filter(Boolean).join(", ")}`)
    console.log(`   Defina DEMO_PASSWORD no .env ou rode: npm run db:users`)
  }
}

// ─── Sem sessão ─────────────────────────────────────────────────────────────
console.log('\n[sem sessão — anônimo não enxerga nada]')
{
  const anon = await fetch(`${URL_BASE}/rest/v1/v_assets_full?select=id`, { headers: { apikey: KEY } })
  const rows = await anon.json().catch(() => [])
  check('NÃO lê ativos', !Array.isArray(rows) || rows.length === 0, `(${anon.status})`)
}

// ─── Técnico: opera, não configura ──────────────────────────────────────────
console.log('\n[technician — opera, mas não configura]')
if (!tokens.technician) { skipped++; console.log('  (pulado: sem sessão)') } else {
  const t = tokens.technician

  const assets = await rest(t, 'v_assets_full?select=id,tag,plant_x')
  check('lê ativos', assets.rows.length > 0, `(${assets.rows.length})`)

  const mtr = assets.rows.find((a) => a.tag === 'MTR-001') ?? assets.rows[0]
  if (mtr) {
    // Reposicionar é faixa 2: a RLS recusa sem erro, devolvendo zero linhas.
    const move = await rest(t, `assets?id=eq.${mtr.id}&select=id`, {
      method: 'PATCH', body: { plant_x: 21 },
    })
    check('NÃO reposiciona ativo', move.rows.length === 0, `(gravou ${move.rows.length})`)

    const del = await rest(t, `assets?id=eq.${mtr.id}&select=id`, { method: 'DELETE' })
    check('NÃO apaga ativo', del.rows.length === 0, `(apagou ${del.rows.length})`)

    // Corrigir placa à mão também é faixa 2 — registrar pelo OCR não é.
    const np = await rest(t, `asset_nameplates?asset_id=eq.${mtr.id}&select=id`, {
      method: 'PATCH', body: { manufacturer: 'x' },
    })
    check('NÃO corrige placa à mão', np.rows.length === 0, `(gravou ${np.rows.length})`)
  }

  const users = await rest(t, 'v_admin_users?select=id')
  check('NÃO enxerga a lista de usuários', users.rows.length === 0, `(${users.rows.length})`)

  const audit = await rest(t, 'audit_logs?select=id,actor_id&limit=50')
  const alheias = audit.rows.filter((r) => r.actor_id && r.actor_id !== ids.technician)
  check('NÃO lê auditoria de TERCEIROS', alheias.length === 0, `(${alheias.length} alheias)`)
  check('lê as próprias ações na auditoria', audit.rows.length > 0, '(nenhuma ação registrada ainda)')

  // Faixa 1 tem de FUNCIONAR: resolver alerta é o teste que pegou o bug antigo,
  // em que a interface dizia "resolvido" para uma escrita que nunca aconteceu.
  const active = await rest(t, 'v_alerts_full?select=id,status&status=neq.resolved&limit=1')
  if (!active.rows[0]) {
    console.log('  ·      sem alerta ativo para testar a resolução (todos resolvidos)')
  }
  if (active.rows[0]) {
    globalThis.__restoreAlert = active.rows[0].id
    const resolved = await rpc(t, 'resolve_alert', { p_alert_id: active.rows[0].id })
    check('RESOLVE alerta (faixa 1)', !resolved.error, JSON.stringify(resolved.error))

    const after = await rest(t, `alerts?id=eq.${active.rows[0].id}&select=status,resolved_by`)
    check('transição carimbada pelo trigger', after.rows[0]?.resolved_by != null)
  }
}

// ─── Engenheiro: configura, não destrói ─────────────────────────────────────
console.log('\n[engineer — configura, mas não destrói]')
if (!tokens.engineer) { skipped++; console.log('  (pulado: sem sessão)') } else {
  const e = tokens.engineer

  const assets = await rest(e, 'v_assets_full?select=id,tag,plant_x')
  check('lê ativos', assets.rows.length > 0, `(${assets.rows.length})`)

  const mtr = assets.rows.find((a) => a.tag === 'MTR-001') ?? assets.rows[0]
  if (mtr) {
    // Configurar FUNCIONA: grava e devolve a linha.
    const move = await rest(e, `assets?id=eq.${mtr.id}&select=id,plant_x`, {
      method: 'PATCH', body: { plant_x: mtr.plant_x },
    })
    check('REPOSICIONA ativo (faixa 2)', move.rows.length === 1, JSON.stringify(move.error))

    // Destruir, não.
    const del = await rest(e, `assets?id=eq.${mtr.id}&select=id`, { method: 'DELETE' })
    check('NÃO apaga ativo (só admin)', del.rows.length === 0, `(apagou ${del.rows.length})`)

    // Privilégio de COLUNA, não policy: o erro é explícito, não silencioso.
    const ml = await rest(e, `assets?id=eq.${mtr.id}&select=id`, {
      method: 'PATCH', body: { health_index: 1 },
    })
    check('NÃO escreve health_index (privilégio de coluna)', !!ml.error,
      `(${ml.error?.code ?? ml.status})`)
  }

  const users = await rest(e, 'v_admin_users?select=id')
  check('NÃO enxerga a lista de usuários', users.rows.length === 0, `(${users.rows.length})`)
}

// ─── Admin: governa ─────────────────────────────────────────────────────────
console.log('\n[admin — governança]')
if (!tokens.admin) { skipped++; console.log('  (pulado: sem sessão)') } else {
  const a = tokens.admin

  const users = await rest(a, 'v_admin_users?select=id,email,role,is_active')
  check('lê a lista de usuários', users.rows.length >= 3, `(${users.rows.length})`)

  const audit = await rest(a, 'audit_logs?select=id&limit=1')
  check('lê a auditoria', !audit.error, JSON.stringify(audit.error))

  // O trigger guard_profile_privileges impede o admin de se rebaixar.
  const me = users.rows.find((u) => u.email === emails.admin)
  if (!me) console.log(`  ·      linha do próprio admin não encontrada em v_admin_users (${emails.admin})`)
  if (me) {
    const self = await rest(a, `profiles?id=eq.${me.id}&select=id`, {
      method: 'PATCH', body: { role: 'technician' },
    })
    check('NÃO rebaixa a si mesmo (trigger)', !!self.error, `(${self.error?.code ?? self.status})`)
  }

  // Configuração pessoal continua pessoal, mesmo para o admin.
  const settings = await rest(a, 'user_settings?select=user_id')
  check('user_settings continua pessoal', settings.rows.length <= 1, `(${settings.rows.length})`)

  if (globalThis.__restoreAlert) {
    await rest(a, `alerts?id=eq.${globalThis.__restoreAlert}&select=id`, {
      method: 'PATCH',
      body: { status: 'active', resolved_at: null, resolved_by: null, resolution_notes: null },
    })
    console.log('  ·      alerta de teste restaurado')
  }
}

console.log(`\n${fail === 0 ? '✓' : '✗'} ${pass} ok, ${fail} falhas${skipped ? `, ${skipped} blocos pulados` : ''}`)
process.exit(fail ? 1 : 0)
