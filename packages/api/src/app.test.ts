import assert from 'node:assert/strict'
import { hc } from 'hono/client'
import { createApi, mountApi, type AppType } from './app'
import { mcpOAuthClientMetadata } from './oauth'
import { MCP_PROXY_AUTHORIZATION_HEADER } from './proxy'

const seen: Array<{ url: string; init?: RequestInit }> = []

const upstreamFetch: typeof fetch = async (input, init) => {
  seen.push({ url: String(input), init })
  const url = String(input)
  if (url.endsWith('.yaml')) {
    return new Response('openapi: 3.1.0\ninfo:\n  title: Local API')
  }
  if (url.includes('/openapi.json')) {
    return new Response('error code: 1042', { status: 404, statusText: 'Not Found' })
  }
  if (url.includes('/mcp')) {
    const headers = new Headers({ 'mcp-session-id': 'session-1' })
    if (init?.method === 'GET') {
      return new Response('event: message\ndata: {}\n\n', {
        headers: { ...Object.fromEntries(headers), 'content-type': 'text/event-stream' },
      })
    }
    return new Response('{"jsonrpc":"2.0","id":1,"result":{}}', {
      status: 200,
      headers,
    })
  }
  return new Response('{"ok":true}', {
    status: 201,
    statusText: 'Created',
    headers: { 'x-upstream': 'direct' },
  })
}

let requestedFeedTags: readonly string[] = []
const api = createApi({
  fetch: upstreamFetch,
  database: {
    async listRegistryFeedRows(tags) {
      requestedFeedTags = tags
      return [
        {
          url: 'https://mcp.example.test',
          title: 'Example MCP',
          type: 'MCP',
          tag: 'trending_mcp',
        },
      ]
    },
  },
})
const client = hc<AppType>('http://hookfish.test', {
  fetch: ((input, init) => api.request(input, init as RequestInit)) as typeof fetch,
})

const registryFeed = await client.registry.feed.$get()
assert.equal(registryFeed.status, 200)
assert.deepEqual(await registryFeed.json(), {
  'MCP Servers': [
    {
      url: 'https://mcp.example.test',
      title: 'Example MCP',
      type: 'MCP',
    },
  ],
  APIs: [],
})
assert.deepEqual(requestedFeedTags, ['trending_mcp', 'trending_api'])

const spec = await client.spec.$post({ json: { url: 'http://localhost:8787/openapi.yaml' } })
assert.equal(spec.status, 200)
assert.deepEqual(await spec.json(), {
  openapi: '3.1.0',
  info: { title: 'Local API' },
})

const executed = await client.execute.$post({
  json: {
    transport: 'http',
    method: 'post',
    url: 'http://localhost:8787/widgets',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"local"}',
  },
})
assert.equal(executed.status, 200)
const executeBody = await executed.json()
assert.equal(executeBody.status.code, 201)
assert.equal(executeBody.body, '{"ok":true}')
assert.equal(executeBody.action, 'POST')

const invalidSpec = await client.spec.$post({ json: { url: 'file:///tmp/openapi.yaml' } })
assert.equal(invalidSpec.status, 400)
assert.deepEqual(await invalidSpec.json(), { error: 'Enter an http or https OpenAPI URL.' })

const oauth = await client['mcp-oauth-client'].$get({ query: { sourceId: 'oauth-source' } })
assert.equal(oauth.status, 200)
assert.equal(oauth.headers.get('cache-control'), 'public, max-age=300')
assert.deepEqual(await oauth.json(), {
  client_id: 'http://hookfish.test/mcp-oauth-client?sourceId=oauth-source',
  ...mcpOAuthClientMetadata('oauth-source', 'http://hookfish.test'),
})

const missingSource = await api.request('/mcp-oauth-client')
assert.equal(missingSource.status, 400)

const proxyUrl = client['mcp-proxy'].$url({ query: { url: 'https://mcp.test/sse' } })
assert.equal(proxyUrl.toString(), 'http://hookfish.test/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fsse')

const proxied = await client['mcp-proxy'].$post({ query: { url: 'https://mcp.test/sse' } })
assert.equal(proxied.status, 200)
assert.equal(proxied.headers.get('mcp-session-id'), 'session-1')
assert.equal(seen.at(-1)?.url, 'https://mcp.test/sse')

const authorizedProxy = await api.request(
  '/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fauthorized',
  {
    method: 'POST',
    headers: {
      [MCP_PROXY_AUTHORIZATION_HEADER]: 'Bearer upstream-token',
    },
  },
)
assert.equal(authorizedProxy.status, 200)
const authorizedHeaders = new Headers(seen.at(-1)?.init?.headers)
assert.equal(authorizedHeaders.get('authorization'), 'Bearer upstream-token')
assert.equal(authorizedHeaders.get(MCP_PROXY_AUTHORIZATION_HEADER), null)

const rejectedProxy = await client['mcp-proxy'].$get({ query: { url: 'file:///tmp/mcp' } })
assert.equal(rejectedProxy.status, 400)

const openapi = await api.request('/openapi.json')
assert.equal(openapi.status, 200)
const document = (await openapi.json()) as {
  openapi: string
  paths: Record<string, unknown>
  servers?: Array<{ url: string }>
}
assert.equal(document.openapi, '3.1.0')
assert.ok(document.paths['/spec'])
assert.ok(document.paths['/execute'])
assert.ok(document.paths['/mcp-proxy'])
assert.ok(document.paths['/mcp-oauth-client'])
assert.ok(document.paths['/registry/feed'])
assert.equal(document.paths['/auth/sign-up'], undefined)
assert.equal(document.paths['/auth/session'], undefined)
assert.equal(document.paths['/registry'], undefined)
assert.equal(document.paths['/registry/{sourceId}'], undefined)

assert.equal((await api.request('/auth/session')).status, 404)
assert.equal((await api.request('/registry')).status, 404)

const mounted = mountApi('/api', { fetch: upstreamFetch })
assert.equal((await mounted.request('/api/registry/feed')).status, 503)
const mountedSpec = await mounted.request('/api/spec', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'http://localhost:8787/openapi.yaml' }),
})
assert.equal(mountedSpec.status, 200)

const mountedDoc = await mounted.request('/api/openapi.json')
const mountedDocument = (await mountedDoc.json()) as { servers?: Array<{ url: string }> }
assert.equal(mountedDocument.servers?.[0]?.url, '/api')

const selfSpec = await api.request('/spec', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'http://localhost/openapi.json' }),
})
assert.equal(selfSpec.status, 200)
assert.deepEqual(await selfSpec.json(), document)
assert.equal(
  seen.some((entry) => entry.url.includes('/openapi.json')),
  false,
)

const mountedSelfSpec = await mounted.request('/api/spec', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'http://localhost/api/openapi.json' }),
})
assert.equal(mountedSelfSpec.status, 200)
assert.equal((await mountedSelfSpec.json() as { openapi?: string }).openapi, '3.1.0')

const selfExecute = await api.request('/execute', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    transport: 'http',
    method: 'get',
    url: 'http://localhost/openapi.json',
  }),
})
assert.equal(selfExecute.status, 200)
const selfExecuteBody = await selfExecute.json()
assert.equal(selfExecuteBody.status.code, 200)
assert.equal(JSON.parse(selfExecuteBody.body).openapi, '3.1.0')
assert.equal(
  seen.some((entry) => entry.url.includes('/openapi.json')),
  false,
)

console.log('api tests passed')
