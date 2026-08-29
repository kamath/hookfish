import assert from 'node:assert/strict'
import { hc } from 'hono/client'
import { createApi, mountApi, type AppType } from './app'
import { mcpOAuthClientMetadata } from './oauth'

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

const api = createApi({ fetch: upstreamFetch })
const client = hc<AppType>('http://hookfish.test', {
  fetch: ((input, init) => api.request(input, init as RequestInit)) as typeof fetch,
})

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

const rejectedProxy = await client['mcp-proxy'].$get({ query: { url: 'file:///tmp/mcp' } })
assert.equal(rejectedProxy.status, 400)

const openapi = await api.request('/openapi.json')
assert.equal(openapi.status, 200)
const document = (await openapi.json()) as {
  openapi: string
  paths: Record<string, unknown>
  servers?: Array<{ url: string }>
  components?: {
    securitySchemes?: Record<string, unknown>
  }
}
assert.equal(document.openapi, '3.1.0')
assert.ok(document.paths['/spec'])
assert.ok(document.paths['/execute'])
assert.ok(document.paths['/mcp-proxy'])
assert.ok(document.paths['/mcp-oauth-client'])
assert.ok(document.paths['/auth/sign-up'])
assert.ok(document.paths['/auth/sign-in'])
assert.ok(document.paths['/auth/sign-out'])
assert.ok(document.paths['/auth/session'])
assert.ok(document.paths['/auth/api-keys'])
assert.deepEqual(document.components?.securitySchemes?.Bearer, {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT or API key',
  description: 'A user JWT or an API key returned by POST /auth/api-keys.',
})
const apiKeyOperations = document.paths['/auth/api-keys'] as {
  get?: { security?: Array<Record<string, unknown>> }
  post?: { security?: Array<Record<string, unknown>> }
}
assert.deepEqual(apiKeyOperations.get?.security, [{ Bearer: [] }])
assert.deepEqual(apiKeyOperations.post?.security, [{ Bearer: [] }])

assert.equal(client.auth['sign-up'].$url().toString(), 'http://hookfish.test/auth/sign-up')
assert.equal(client.auth['sign-in'].$url().toString(), 'http://hookfish.test/auth/sign-in')
assert.equal(client.auth['sign-out'].$url().toString(), 'http://hookfish.test/auth/sign-out')
assert.equal(client.auth.session.$url().toString(), 'http://hookfish.test/auth/session')
assert.equal(client.auth['api-keys'].$url().toString(), 'http://hookfish.test/auth/api-keys')

const mounted = mountApi('/api', { fetch: upstreamFetch })
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
