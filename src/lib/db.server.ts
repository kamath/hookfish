import { env } from 'cloudflare:workers'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS apis (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT,
    spec_url TEXT NOT NULL,
    spec_json TEXT NOT NULL,
    operation_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_apis_username ON apis (username)`,
]

let schemaReady = false

export async function getDb(): Promise<D1Database> {
  if (!env.DB) {
    throw new Error('D1 binding DB is missing. Check wrangler.jsonc.')
  }

  if (!schemaReady) {
    for (const statement of STATEMENTS) {
      await env.DB.prepare(statement).run()
    }
    schemaReady = true
  }

  return env.DB
}
