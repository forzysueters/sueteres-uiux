#!/usr/bin/env node
/**
 * Gera src/types/database.ts a partir do schema real do Postgres.
 *
 * Equivalente a `supabase gen types typescript`, porém por introspecção via
 * conexão direta — não exige Docker nem a CLI do Supabase.
 *
 * Uso: node scripts/gen-types.mjs   (requer SUPABASE_DB_URL)
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
  console.error('Defina SUPABASE_DB_URL para gerar os tipos.')
  process.exit(1)
}

const OUT = path.resolve(process.cwd(), 'src/types/database.ts')

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// ─── Enums ───────────────────────────────────────────────────────────────────
const { rows: enumRows } = await client.query(`
  select t.typname::text as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname
`)
const enumNames = new Set(enumRows.map((r) => r.name))

// ─── Colunas de tabelas e views ──────────────────────────────────────────────
const { rows: colRows } = await client.query(`
  select
    c.relname                                as rel,
    c.relkind                                as kind,
    a.attname                                as column,
    a.attnum                                 as ord,
    format_type(a.atttypid, a.atttypmod)     as data_type,
    t.typname                                as type_name,
    not a.attnotnull                         as nullable,
    (d.adbin is not null or a.attidentity <> '' or a.attgenerated <> '') as has_default,
    a.attgenerated <> ''                     as generated
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  join pg_type t on t.oid = a.atttypid
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and not c.relispartition
  order by c.relname, a.attnum
`)

// ─── Relacionamentos (foreign keys) ──────────────────────────────────────────
// O postgrest-js exige `Relationships` em cada tabela/view; sem isso o schema
// não satisfaz GenericSchema e todas as consultas degradam para `never`.
const { rows: fkRows } = await client.query(`
  select
    c.relname::text                                as rel,
    con.conname::text                              as fk_name,
    (select array_agg(att.attname::text order by u.ord)
       from unnest(con.conkey) with ordinality as u(attnum, ord)
       join pg_attribute att on att.attrelid = con.conrelid and att.attnum = u.attnum) as columns,
    ref.relname::text                              as referenced_relation,
    (select array_agg(att.attname::text order by u.ord)
       from unnest(con.confkey) with ordinality as u(attnum, ord)
       join pg_attribute att on att.attrelid = con.confrelid and att.attnum = u.attnum) as referenced_columns,
    exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid
        and i.indisunique
        and i.indkey::int2[] @> con.conkey
        and con.conkey @> i.indkey::int2[]
    )                                              as is_one_to_one
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_class ref on ref.oid = con.confrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f' and n.nspname = 'public'
  order by c.relname, con.conname
`)

const fkByRel = new Map()
for (const fk of fkRows) {
  if (!fkByRel.has(fk.rel)) fkByRel.set(fk.rel, [])
  fkByRel.get(fk.rel).push(fk)
}

// ─── Funções (RPC) ───────────────────────────────────────────────────────────
const { rows: fnRows } = await client.query(`
  select
    p.proname                        as name,
    pg_get_function_arguments(p.oid) as args,
    pg_get_function_result(p.oid)    as result,
    p.proretset                      as returns_set
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid and d.deptype = 'e'
    )
    and p.prorettype <> 'trigger'::regtype
  order by p.proname
`)

await client.end()

// ─── Mapeamento de tipos ─────────────────────────────────────────────────────
function tsType(pgType) {
  const t = pgType.replace(/\(.*\)/, '').trim().toLowerCase()

  if (t.endsWith('[]')) return `${tsType(t.slice(0, -2))}[]`
  if (enumNames.has(t)) return `Database["public"]["Enums"]["${t}"]`

  switch (t) {
    case 'boolean':
    case 'bool':
      return 'boolean'
    case 'smallint': case 'int2':
    case 'integer':  case 'int4':
    case 'bigint':   case 'int8':
    case 'numeric':  case 'decimal':
    case 'real':     case 'float4':
    case 'double precision': case 'float8':
      return 'number'
    case 'json':
    case 'jsonb':
      return 'Json'
    case 'text': case 'character varying': case 'varchar': case 'character': case 'char': case 'name':
    case 'uuid': case 'inet': case 'cidr': case 'macaddr':
    case 'date': case 'time': case 'timetz': case 'interval':
    case 'timestamp with time zone': case 'timestamptz':
    case 'timestamp without time zone': case 'timestamp':
    case 'vector':
      return 'string'
    case 'void':
      return 'undefined'
    case 'record':
      return 'Record<string, unknown>'
    default:
      return 'unknown'
  }
}

// Converte "TABLE(a uuid, b text)" no tipo de objeto correspondente.
function parseResult(result, returnsSet) {
  const m = result.match(/^TABLE\((.*)\)$/is)
  if (m) {
    const cols = splitTop(m[1]).map((seg) => {
      const s = seg.trim()
      const i = s.indexOf(' ')
      return `          ${JSON.stringify(s.slice(0, i))}: ${tsType(s.slice(i + 1))}`
    })
    return `{\n${cols.join('\n')}\n        }[]`
  }
  if (/^SETOF\s+/i.test(result)) {
    const inner = result.replace(/^SETOF\s+/i, '')
    return `${tsType(inner)}[]`
  }
  const base = tsType(result)
  return returnsSet ? `${base}[]` : base
}

// Divide por vírgulas de primeiro nível (ignora as que estão dentro de parênteses).
function splitTop(s) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

function parseArgs(args) {
  if (!args.trim()) return []
  return splitTop(args).map((seg) => {
    const s = seg.trim()
    const defIdx = s.toUpperCase().indexOf(' DEFAULT ')
    const hasDefault = defIdx !== -1
    const decl = hasDefault ? s.slice(0, defIdx) : s
    const cleaned = decl.replace(/^(variadic|in|out|inout)\s+/i, '')
    const isVariadic = /^variadic\s+/i.test(decl)
    const i = cleaned.indexOf(' ')
    return {
      name: cleaned.slice(0, i),
      type: tsType(cleaned.slice(i + 1)),
      optional: hasDefault || isVariadic,
    }
  })
}

function emitRelationships(rel, indent) {
  const fks = fkByRel.get(rel) ?? []
  if (fks.length === 0) return [`${indent}Relationships: []`]

  const lines = [`${indent}Relationships: [`]
  for (const fk of fks) {
    lines.push(`${indent}  {`)
    lines.push(`${indent}    foreignKeyName: ${JSON.stringify(fk.fk_name)}`)
    lines.push(`${indent}    columns: ${JSON.stringify(fk.columns ?? [])}`)
    lines.push(`${indent}    isOneToOne: ${fk.is_one_to_one ? 'true' : 'false'}`)
    lines.push(`${indent}    referencedRelation: ${JSON.stringify(fk.referenced_relation)}`)
    lines.push(`${indent}    referencedColumns: ${JSON.stringify(fk.referenced_columns ?? [])}`)
    lines.push(`${indent}  },`)
  }
  lines.push(`${indent}]`)
  return lines
}

// ─── Emissão ─────────────────────────────────────────────────────────────────
const byRel = new Map()
for (const c of colRows) {
  if (!byRel.has(c.rel)) byRel.set(c.rel, { kind: c.kind, cols: [] })
  byRel.get(c.rel).cols.push(c)
}

const tables = []
const views = []
for (const [rel, info] of [...byRel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  ;(info.kind === 'v' || info.kind === 'm' ? views : tables).push([rel, info])
}

const L = []
L.push('/**')
L.push(' * Tipos do banco — GERADO AUTOMATICAMENTE. Não edite à mão.')
L.push(' * Regenere com: npm run db:types')
L.push(' */')
L.push('')
L.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]')
L.push('')
L.push('export interface Database {')
L.push('  public: {')

// Tables
L.push('    Tables: {')
for (const [rel, info] of tables) {
  L.push(`      ${rel}: {`)
  L.push('        Row: {')
  for (const c of info.cols) {
    L.push(`          ${c.column}: ${tsType(c.data_type)}${c.nullable ? ' | null' : ''}`)
  }
  L.push('        }')
  L.push('        Insert: {')
  for (const c of info.cols) {
    if (c.generated) continue
    const optional = c.nullable || c.has_default
    L.push(`          ${c.column}${optional ? '?' : ''}: ${tsType(c.data_type)}${c.nullable ? ' | null' : ''}`)
  }
  L.push('        }')
  L.push('        Update: {')
  for (const c of info.cols) {
    if (c.generated) continue
    L.push(`          ${c.column}?: ${tsType(c.data_type)}${c.nullable ? ' | null' : ''}`)
  }
  L.push('        }')
  L.push(...emitRelationships(rel, '        '))
  L.push('      }')
}
L.push('    }')

// Views
L.push('    Views: {')
for (const [rel, info] of views) {
  L.push(`      ${rel}: {`)
  L.push('        Row: {')
  for (const c of info.cols) {
    L.push(`          ${c.column}: ${tsType(c.data_type)}${c.nullable ? ' | null' : ''}`)
  }
  L.push('        }')
  L.push(...emitRelationships(rel, '        '))
  L.push('      }')
}
L.push('    }')

// Functions
L.push('    Functions: {')
const seen = new Set()
for (const f of fnRows) {
  if (seen.has(f.name)) continue // ignora sobrecargas além da primeira
  seen.add(f.name)
  const args = parseArgs(f.args)
  L.push(`      ${f.name}: {`)
  if (args.length === 0) {
    L.push('        Args: Record<PropertyKey, never>')
  } else {
    L.push('        Args: {')
    for (const a of args) L.push(`          ${a.name}${a.optional ? '?' : ''}: ${a.type}`)
    L.push('        }')
  }
  L.push(`        Returns: ${parseResult(f.result, f.returns_set)}`)
  L.push('      }')
}
L.push('    }')

// Enums
L.push('    Enums: {')
for (const e of enumRows) {
  L.push(`      ${e.name}: ${e.labels.map((l) => JSON.stringify(l)).join(' | ')}`)
}
L.push('    }')

L.push('    CompositeTypes: Record<PropertyKey, never>')
L.push('  }')
L.push('}')
L.push('')
L.push('type PublicSchema = Database["public"]')
L.push('')
L.push('export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]')
L.push('export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]')
L.push('export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]')
L.push('export type ViewRow<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]')
L.push('export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]')
L.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, L.join('\n'), 'utf8')
console.log(`✓ ${path.relative(process.cwd(), OUT)} — ${tables.length} tabelas, ${views.length} views, ${seen.size} funções, ${enumRows.length} enums`)
