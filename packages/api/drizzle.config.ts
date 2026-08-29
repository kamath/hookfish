import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDatabaseTarget } from './src/db/url'

const root = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(root, '../../.env') })
config({ path: resolve(root, '.env') })

const target = resolveDatabaseTarget({
  POSTGRES_URL: process.env.POSTGRES_URL,
  DRIZZLE_PROD: process.env.DRIZZLE_PROD,
  npm_lifecycle_event: process.env.npm_lifecycle_event,
  PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
})

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  ...(target.kind === 'pglite'
    ? {
        driver: 'pglite' as const,
        dbCredentials: { url: target.dataDir },
      }
    : {
        dbCredentials: { url: target.url },
      }),
})
