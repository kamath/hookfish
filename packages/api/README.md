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
adapted to Node, Vercel, or Cloudflare Workers. The database supplies the
`GET /registry/feed` endpoint from `registry` rows (`row_id`, `url`, `title`, and
`type`) joined to `tags` rows (`registry_row_id`, `tag`). The feed includes entries tagged
`trending_mcp` or `trending_api`; `type` is `MCP` or `API`. `POST /spec` can set
`save: true` to upsert the fetched document's title and URL into `registry` as an
`API` row when a database is configured.
