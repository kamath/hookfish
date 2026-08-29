import { mountApi } from '@hookfish/api/app'
import { createPostgresDb } from '@hookfish/api/postgres'
import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'

function databaseConnection() {
  const runtimeEnv = env as typeof env & {
    HYPERDRIVE?: { connectionString: string }
    POSTGRES_URL?: string
  }
  const connection = runtimeEnv.HYPERDRIVE ?? runtimeEnv.POSTGRES_URL
  if (!connection) {
    throw new Error('Cloudflare requires a Hyperdrive binding or POSTGRES_URL secret.')
  }
  return connection
}

const api = mountApi('/api', {
  database: () => createPostgresDb(databaseConnection()),
})

const handle = ({ request }: { request: Request }) => api.fetch(request)

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: handle,
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
      HEAD: handle,
    },
  },
})
