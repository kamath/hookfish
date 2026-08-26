import { createFileRoute } from '@tanstack/react-router'
import { mcpOAuthClientMetadata } from '../lib/mcp/oauth'

export const Route = createFileRoute('/api/mcp-oauth-client')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const sourceId = url.searchParams.get('sourceId')
        if (!sourceId) {
          return Response.json({ error: 'A sourceId is required.' }, { status: 400 })
        }
        return Response.json(
          {
            client_id: url.toString(),
            ...mcpOAuthClientMetadata(sourceId, url.origin),
          },
          {
          headers: {
            'Cache-Control': 'public, max-age=300',
          },
          },
        )
      },
    },
  },
})
