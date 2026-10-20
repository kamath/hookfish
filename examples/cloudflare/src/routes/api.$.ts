import { mountApi } from '@hookfish/api/app'
import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'

const runtimeEnv: { EXA_API_KEY?: string } = env

const api = mountApi('/api', { exaApiKey: runtimeEnv.EXA_API_KEY })

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
