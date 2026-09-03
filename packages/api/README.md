# @hookfish/api

Mountable Hono API for the Hookfish client.

```ts
import { mountApi } from '@hookfish/api/app'
import { createPostgresDb } from '@hookfish/api/postgres'

const postgresUrl = process.env.POSTGRES_URL
if (!postgresUrl) throw new Error('POSTGRES_URL is required.')

const api = mountApi('/api', {
  database: createPostgresDb(postgresUrl),
})
const response = await api.fetch(request)
```

`database` accepts a configured Drizzle database, a promise for one, or a
zero-argument factory. Use
`createPostgresDb(url)` for a Postgres URL,
`() => createPostgresDb(env.HYPERDRIVE)` for request-scoped Cloudflare
Hyperdrive, or
`createPgliteDb()` from `@hookfish/api/pglite` for local PGlite.

The returned application uses Web-standard `Request` and `Response` objects and can be
adapted to Node, Vercel, or Cloudflare Workers.
