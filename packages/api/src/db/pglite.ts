import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { schema } from './schema'
import { resolvePgliteDataDir } from './url'

export function findDrizzleMigrationsDir(moduleUrl = import.meta.url) {
  if (process.env.DRIZZLE_MIGRATIONS_DIR) {
    return process.env.DRIZZLE_MIGRATIONS_DIR
  }

  let dir = dirname(fileURLToPath(moduleUrl))
  for (let i = 0; i < 10; i++) {
    for (const candidate of [join(dir, 'drizzle'), join(dir, 'assets', 'drizzle')]) {
      if (existsSync(join(candidate, 'meta/_journal.json'))) {
        return candidate
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }

  throw new Error('Could not find drizzle migrations (meta/_journal.json).')
}

export async function createPgliteDb(dataDir = resolvePgliteDataDir()) {
  const client = new PGlite(dataDir)
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: findDrizzleMigrationsDir() })
  return db
}
