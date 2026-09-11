import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const files = ['apps/web/.env.local', 'apps/web/.env']
const values = {}
for (const file of files) {
  const target = resolve(file)
  if (!existsSync(target)) continue
  for (const line of readFileSync(target, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
const missing = required.filter((key) => !values[key])
if (missing.length) {
  console.error(`[env:web] ausentes: ${missing.join(', ')}`)
  console.error('Copie apps/web/.env.example para apps/web/.env.local e preencha os valores.')
  process.exit(1)
}
console.log('[env:web] ok')
