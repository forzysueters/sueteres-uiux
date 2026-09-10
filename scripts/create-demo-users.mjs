#!/usr/bin/env node
/**
 * Cria (ou atualiza) as contas de demonstração via Auth Admin API.
 *
 * O trigger `on_auth_user_created` cuida de popular public.profiles e
 * public.user_settings a partir do user_metadata enviado aqui.
 *
 * Uso: node scripts/create-demo-users.mjs
 * Requer SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente (ou em .env.local).
 */
import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = (m[2] ?? '').replace(/^['"]|['"]$/g, '')
      }
    }
  }
}
loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY antes de rodar este script.')
  process.exit(1)
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123'

const users = [
  {
    email: 'admin@industrial.com',
    full_name: 'Administrador Forzy',
    role: 'admin',
    job_title: 'Administrador da Plataforma',
    department: 'Forzy Lab',
  },
  {
    email: 'engineer@industrial.com',
    full_name: 'Ana Souza',
    role: 'engineer',
    job_title: 'Engenheira de Confiabilidade',
    department: 'Engenharia de Manutenção',
  },
  {
    email: 'technician@industrial.com',
    full_name: 'Carlos Silva',
    role: 'technician',
    job_title: 'Técnico de Manutenção',
    department: 'Manutenção Industrial',
  },
  // A conta `viewer@industrial.com` saiu na migração 0016: o papel deixou de
  // existir. Se ela ainda estiver no projeto, a migração a rebaixou para
  // technician INATIVO — o admin decide na tela de usuários se libera ou apaga.
]

const headers = {
  apikey: SECRET_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
  'Content-Type': 'application/json',
}

async function findByEmail(email) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Listagem falhou: ${res.status} ${await res.text()}`)
  const body = await res.json()
  return (body.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase())
}

for (const u of users) {
  const { email, role, ...meta } = u
  const existing = await findByEmail(email)

  const payload = {
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    // O papel vai em app_metadata: user_metadata é escrito pelo próprio cliente
    // no signup, então não serve para conceder privilégio (ver migração 0013).
    app_metadata: { role },
    user_metadata: { ...meta, role },
  }

  const res = existing
    ? await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      })
    : await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

  if (!res.ok) {
    console.error(`✗ ${email}: ${res.status} ${await res.text()}`)
    process.exitCode = 1
    continue
  }

  const created = await res.json()
  console.log(`${existing ? '↻' : '✓'} ${email} (${role}) → ${created.id}`)
}
