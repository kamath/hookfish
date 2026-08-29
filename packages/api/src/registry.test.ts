import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hc } from 'hono/client'
import { createApi, type AppType } from './app'
import { createPgliteDb } from './db/pglite'

const dataDir = mkdtempSync(join(tmpdir(), 'hookfish-registry-'))
const seen: string[] = []
const upstreamFetch: typeof fetch = async (input) => {
  const url = String(input)
  seen.push(url)
  if (url.includes('openapi')) {
    return Response.json({
      openapi: '3.1.0',
      info: { title: 'Cached API' },
      paths: {},
    })
  }
  return Response.json({ jsonrpc: '2.0', id: 1, result: {} })
}

const api = createApi({
  database: createPgliteDb(dataDir),
  fetch: upstreamFetch,
})
const client = hc<AppType>('http://hookfish.test', {
  fetch: ((input, init) => api.request(input, init as RequestInit)) as typeof fetch,
})

const openApiUrl = 'https://example.test/openapi.json'
const spec = await client.spec.$post({ json: { url: openApiUrl } })
assert.equal(spec.status, 200)

const cachedOpenApi = await client.registry.$get({ query: { url: openApiUrl } })
assert.equal(cachedOpenApi.status, 200)
assert.deepEqual(await cachedOpenApi.json(), {
  url: openApiUrl,
  kind: 'openapi',
  document: {
    openapi: '3.1.0',
    info: { title: 'Cached API' },
    paths: {},
  },
})
assert.equal(seen.filter((url) => url === openApiUrl).length, 1)

const mcpUrl = 'https://mcp.example.test/rpc'
const mcp = await client['mcp-proxy'].$post({ query: { url: mcpUrl } })
assert.equal(mcp.status, 200)

const cachedMcp = await client.registry.$get({ query: { url: mcpUrl } })
assert.equal(cachedMcp.status, 200)
assert.deepEqual(await cachedMcp.json(), {
  url: mcpUrl,
  kind: 'mcp',
})

const missing = await client.registry.$get({
  query: { url: 'https://missing.example.test/spec.json' },
})
assert.equal(missing.status, 404)
assert.deepEqual(await missing.json(), {
  error: 'No cached result exists for this URL.',
})

const invalid = await client.registry.$get({ query: { url: 'file:///tmp/spec.json' } })
assert.equal(invalid.status, 400)

const noDatabase = createApi()
const unavailable = await noDatabase.request(`/registry?url=${encodeURIComponent(openApiUrl)}`)
assert.equal(unavailable.status, 503)

console.log('registry tests passed')
