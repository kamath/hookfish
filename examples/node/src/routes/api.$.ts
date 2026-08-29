import { mountApi } from '@hookfish/api/app'
import { createPgliteDb } from '@hookfish/api/pglite'
import { createPostgresDb } from '@hookfish/api/postgres'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'

const database = process.env.POSTGRES_URL
  ? createPostgresDb(process.env.POSTGRES_URL)
  : createPgliteDb()

const api = mountApi('/api', {
  database,
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
