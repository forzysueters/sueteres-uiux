#!/usr/bin/env node
/**
 * Aplicador de migrações e seed do Supabase.
 *
 * Conecta direto ao Postgres do projeto (SUPABASE_DB_URL) e executa os arquivos
 * de supabase/migrations em ordem, cada um em sua própria transação.
 *
 * Todas as migrações são idempotentes, então rodar de novo é seguro.
 *
 *   node scripts/db.mjs migrate   → aplica supabase/migrations/*.sql
 *   node scripts/db.mjs seed      → aplica supabase/seed.sql
 *   node scripts/db.mjs all       → migrate + seed
 */
import pg from 'pg'
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

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) {
  console.error('Defina SUPABASE_DB_URL no .env (veja .env.example).')
  process.exit(1)
}

const command = process.argv[2] || 'all'
const root = process.cwd()
const migrationsDir = path.join(root, 'supabase', 'migrations')
const seedFile = path.join(root, 'supabase', 'seed.sql')

const files = []
if (command === 'migrate' || command === 'all') {
  files.push(
    ...fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => path.join(migrationsDir, f)),
  )
}
if (command === 'seed' || command === 'all') {
  files.push(seedFile)
}

if (files.length === 0) {
  console.error(`Comando desconhecido: ${command}. Use migrate, seed ou all.`)
  process.exit(1)
}

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  statement_timeout: 600000,
})

await client.connect()
await client.query('set search_path = public, extensions')

let failed = false
for (const file of files) {
  const name = path.relative(root, file)
  const sql = fs.readFileSync(file, 'utf8')
  process.stdout.write(`  ${name} … `)

  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log('ok')
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.log('FALHOU')
    console.error(`\n  ${error.message}`)
    if (error.detail) console.error(`  detalhe: ${error.detail}`)
    if (error.hint) console.error(`  dica: ${error.hint}`)
    failed = true
    break
  }
}

await client.end()

if (!failed) console.log('\n✓ Banco atualizado.')
process.exit(failed ? 1 : 0)
