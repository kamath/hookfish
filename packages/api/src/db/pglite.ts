import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { listRegistryFeedRows, upsertRegistryEntry } from './queries'
import { schema } from './schema'
import type { AppDatabase } from './types'
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

export async function createPgliteDb(
  dataDir = resolvePgliteDataDir({
    PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
  }),
): Promise<AppDatabase> {
  const client = new PGlite(dataDir)
  const database = drizzle({ client, schema })
  await migrate(database, { migrationsFolder: findDrizzleMigrationsDir() })
  return {
    listRegistryFeedRows: (feedTags) => listRegistryFeedRows(database, feedTags),
    upsertRegistryEntry: (entry) => upsertRegistryEntry(database, entry),
  }
}
