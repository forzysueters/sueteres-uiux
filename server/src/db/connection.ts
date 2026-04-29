/**
 * Conexão SQLite com better-sqlite3 (síncrono, perfeito para tempo-real
 * em escala de demo e Sprint 1). O arquivo do banco é criado em
 * server/data/digital-twin.db e o schema é aplicado idempotentemente.
 */
import Database from 'better-sqlite3'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_DIR = resolve(__dirname, '../../data')
const DB_PATH = process.env.DB_PATH || resolve(DB_DIR, 'digital-twin.db')
const SCHEMA_PATH = resolve(__dirname, 'schema.sql')

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}

export const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

// Aplica o schema (CREATE IF NOT EXISTS — idempotente).
const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8')
db.exec(schemaSql)

console.log(`📦 SQLite ready at ${DB_PATH}`)
