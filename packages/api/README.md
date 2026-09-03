# @hookfish/api

Mountable Hono API for the Smithery client.

```ts
import { mountApi } from '@hookfish/api/app'
import { createPostgresDb } from '@hookfish/api/postgres'

const api = mountApi('/api', {
  database: createPostgresDb(process.env.POSTGRES_URL!),
})
const response = await api.fetch(request)
```

The returned application uses Web-standard `Request` and `Response` objects and can be
adapted to Node, Vercel, or Cloudflare Workers. The database supplies the read-only
`GET /registry/feed` endpoint from a single `suggested_source` table containing `url`,
`title`, and `category_name` text columns.
