import { mountApi } from '@hookfish/api/app'
import { createPostgresDb } from '@hookfish/api/postgres'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'

const api = mountApi('/api', {
  database: () => {
    const postgresUrl = process.env.POSTGRES_URL
    if (!postgresUrl) {
      throw new Error('POSTGRES_URL is required.')
    }
    return createPostgresDb(postgresUrl)
  },
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
