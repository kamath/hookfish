import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { resolveRuntimeEnv } from './env'
import { createPgliteDb } from './pglite'
import { schema } from './schema'
import {
  resolveDatabaseTarget,
  type DatabaseTarget,
  type RuntimeEnv,
} from './url'

export type AppDb = Awaited<ReturnType<typeof createDbFromTarget>>

const dbCache = new Map<string, Promise<AppDb>>()

function cacheKey(target: DatabaseTarget) {
  return target.kind === 'postgres' ? `postgres:${target.url}` : `pglite:${target.dataDir}`
}

async function createDbFromTarget(target: DatabaseTarget) {
  if (target.kind === 'postgres') {
    const client = postgres(target.url, {
      max: 5,
      fetch_types: false,
      prepare: true,
    })
    return drizzle({ client, schema })
  }

  return createPgliteDb(target.dataDir)
}

export async function createDb(env: RuntimeEnv = {}) {
  return createDbFromTarget(resolveDatabaseTarget(env))
}

export async function getDb(env?: RuntimeEnv) {
  const resolved = env ?? (await resolveRuntimeEnv())
  const target = resolveDatabaseTarget(resolved)
  const key = cacheKey(target)
  const cached = dbCache.get(key)
  if (cached) {
    return cached
  }

  const created = createDbFromTarget(target)
  dbCache.set(key, created)
  return created
}

export { schema } from './schema'
export { resolveDatabaseTarget, resolvePgliteDataDir, type RuntimeEnv } from './url'
