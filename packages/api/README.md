# @hookfish/api

Mountable Hono API for the Hookfish client.

```ts
import { mountApi } from '@hookfish/api/app'

const api = mountApi('/api', {
  exaApiKey: process.env.EXA_API_KEY,
})
const response = await api.fetch(request)
```

The returned application uses Web-standard `Request` and `Response` objects and can be
adapted to Node, Vercel, or Cloudflare Workers. `GET /registry/feed` returns the built-in
suggested sources keyed by category; `type` is `MCP` or `API`. `GET /registry/search?q=`
finds remote MCP servers through Exa structured output and needs `exaApiKey`; without it the
route answers `503`.
