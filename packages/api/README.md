# @hookfish/api

Mountable Hono API for the Smithery client.

```ts
import { mountApi } from '@hookfish/api'

const api = mountApi('/api')
const response = await api.fetch(request)
```

The returned application uses Web-standard `Request` and `Response` objects and can be
adapted to Node, Vercel, or Cloudflare Workers.
