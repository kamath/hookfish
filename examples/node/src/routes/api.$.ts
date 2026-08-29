import { mountApi } from '@hookfish/api/app'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'

const api = mountApi('/api')

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
