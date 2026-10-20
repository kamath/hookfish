import assert from 'node:assert/strict'
import { hc } from 'hono/client'
import { createApi, mountApi, type AppType } from './app'
import { mcpOAuthClientMetadata } from './oauth'
import { MCP_PROXY_HEADERS_HEADER } from './headers'
import { MCP_PROXY_AUTHORIZATION_HEADER } from './proxy'

const seen: Array<{ url: string; init?: RequestInit }> = []

const upstreamFetch: typeof fetch = async (input, init) => {
  seen.push({ url: String(input), init })
  const url = String(input)
  if (url === 'https://api.exa.ai/search') {
    const body = JSON.parse(String(init?.body)) as { query: string }
    if (body.query.includes('broken')) {
      return new Response('{}', { status: 500 })
    }
    return Response.json({
      results: [],
      output: {
        content: {
          servers: [
            {
              name: 'Linear MCP Server',
              mcpUrl: 'https://mcp.linear.app/mcp',
              homepage: 'https://linear.app/docs/mcp',
              description: 'Read and write Linear issues.',
              authType: 'oauth',
            },
          ],
        },
      },
    })
  }
  if (url.endsWith('.yaml')) {
    return new Response(`openapi: 3.1.0
info:
  title: Local API
servers:
  - url: http://localhost:8787
paths:
  /widgets:
    post:
      responses:
        '201':
          description: Created
`)
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
    headers.set('content-encoding', 'br')
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

const api = createApi({
  fetch: upstreamFetch,
  exaApiKey: 'exa-test-key',
})
const client = hc<AppType>('http://hookfish.test', {
  fetch: ((input, init) => api.request(input, init as RequestInit)) as typeof fetch,
})

const registryFeed = await client.registry.feed.$get()
assert.equal(registryFeed.status, 200)
const feed = await registryFeed.json()
assert.deepEqual(Object.keys(feed), ['MCP Servers', 'APIs'])
// MCP servers alternate between Arcade-hosted and first-party.
assert.deepEqual(
  feed['MCP Servers']?.map((item) => item.title),
  ['Gmail (Arcade)', 'Linear', 'Google Calendar (Arcade)', 'Notion', 'Slack (Arcade)'],
)
assert.equal(feed.APIs?.length, 5)

const search = await client.registry.search.$get({ query: { q: 'linear' } })
assert.equal(search.status, 200)
assert.deepEqual(await search.json(), {
  results: [
    {
      url: 'https://mcp.linear.app/mcp',
      title: 'Linear MCP Server',
      type: 'MCP',
      homepage: 'https://linear.app/docs/mcp',
      description: 'Read and write Linear issues.',
      auth: 'oauth',
      headers: [],
    },
  ],
})
const exaRequest = seen.find((entry) => entry.url === 'https://api.exa.ai/search')
assert.equal(new Headers(exaRequest?.init?.headers).get('x-api-key'), 'exa-test-key')
assert.match(JSON.parse(String(exaRequest?.init?.body)).query, /linear/)

assert.equal((await api.request('/registry/search?q=%20')).status, 400)
assert.equal((await api.request('/registry/search?q=broken')).status, 502)

const spec = await client.spec.$post({ json: { url: 'http://localhost:8787/openapi.yaml' } })
assert.equal(spec.status, 200)
assert.deepEqual(await spec.json(), {
  openapi: '3.1.0',
  info: { title: 'Local API' },
  servers: [{ url: 'http://localhost:8787' }],
  paths: {
    '/widgets': {
      post: {
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
  },
})

const executed = await client.execute.$post({
  json: {
    specUrl: 'http://localhost:8787/openapi.yaml',
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

const missingSpecUrl = await api.request('/execute', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    transport: 'http',
    method: 'post',
    url: 'http://localhost:8787/widgets',
  }),
})
assert.equal(missingSpecUrl.status, 400)

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

const initializeBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {},
})
const proxied = await api.request('/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fsse', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: initializeBody,
})
assert.equal(proxied.status, 200)
assert.equal(proxied.headers.get('mcp-session-id'), 'session-1')
assert.equal(proxied.headers.get('content-encoding'), null, 'decoded bodies drop content-encoding')
assert.equal(proxied.headers.get('cache-control'), 'no-store', 'credentialed responses are never cached')
assert.equal(await proxied.text(), '{"jsonrpc":"2.0","id":1,"result":{}}')

const unreachableApi = createApi({
  fetch: async () => {
    throw new TypeError('fetch failed')
  },
})
const unreachable = await unreachableApi.request('/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fdown', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    [MCP_PROXY_AUTHORIZATION_HEADER]: 'Bearer secret-token',
  },
  body: initializeBody,
})
assert.equal(unreachable.status, 502)
assert.equal(
  (await unreachable.text()).includes('secret-token'),
  false,
  'an unreachable server is reported without echoing credentials',
)

const frame = await api.request('/mcp-app-frame')
assert.equal(frame.status, 200)
assert.match(frame.headers.get('content-type') ?? '', /text\/html/)
assert.equal(
  frame.headers.get('content-security-policy'),
  "sandbox allow-scripts allow-forms; frame-ancestors 'self'",
  'the frame document stays sandboxed even when opened directly',
)
assert.match(await frame.text(), /event\.source !== parent/)
assert.equal(seen.at(-1)?.url, 'https://mcp.test/sse')
assert.equal(seen.at(-1)?.init?.body, initializeBody)

const authorizedProxy = await api.request(
  '/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fauthorized',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [MCP_PROXY_AUTHORIZATION_HEADER]: 'Bearer upstream-token',
    },
    body: initializeBody,
  },
)
assert.equal(authorizedProxy.status, 200)
const authorizedHeaders = new Headers(seen.at(-1)?.init?.headers)
assert.equal(authorizedHeaders.get('authorization'), 'Bearer upstream-token')
assert.equal(authorizedHeaders.get(MCP_PROXY_AUTHORIZATION_HEADER), null)

const customProxy = await api.request(
  '/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fcustom',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [MCP_PROXY_HEADERS_HEADER]: JSON.stringify({
        'X-Api-Key': 'key-1',
        Authorization: 'Bearer custom',
        Host: 'evil.test',
        Cookie: 'a=b',
        'x-hookfish-mcp-authorization': 'Bearer smuggled',
        'X-Split': 'a\r\nInjected: yes',
      }),
    },
    body: initializeBody,
  },
)
assert.equal(customProxy.status, 200)
const customHeaders = new Headers(seen.at(-1)?.init?.headers)
assert.equal(customHeaders.get('x-api-key'), 'key-1')
assert.equal(customHeaders.get('authorization'), 'Bearer custom')
assert.equal(customHeaders.get('host'), null)
assert.equal(customHeaders.get('cookie'), null)
assert.equal(customHeaders.get('x-split'), null)
assert.equal(customHeaders.get('injected'), null)
assert.equal(customHeaders.get(MCP_PROXY_HEADERS_HEADER), null)
assert.equal(customHeaders.get(MCP_PROXY_AUTHORIZATION_HEADER), null)

await api.request('/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fcustom', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    [MCP_PROXY_HEADERS_HEADER]: JSON.stringify({ Authorization: 'Bearer custom' }),
    [MCP_PROXY_AUTHORIZATION_HEADER]: 'Bearer resolved',
  },
  body: initializeBody,
})
assert.equal(new Headers(seen.at(-1)?.init?.headers).get('authorization'), 'Bearer resolved')

await api.request('/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fcustom', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    [MCP_PROXY_HEADERS_HEADER]: 'not json',
  },
  body: initializeBody,
})
assert.equal(new Headers(seen.at(-1)?.init?.headers).get('x-api-key'), null)

const rejectedProxy = await client['mcp-proxy'].$get({ query: { url: 'file:///tmp/mcp' } })
assert.equal(rejectedProxy.status, 400)

const rejectedGenericProxy = await api.request(
  '/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fsse',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://evil.test', name: 'local' }),
  },
)
assert.equal(rejectedGenericProxy.status, 400)

const rejectedProxyMethod = await api.request(
  '/mcp-proxy?url=https%3A%2F%2Fmcp.test%2Fsse',
  { method: 'PUT' },
)
assert.equal(rejectedProxyMethod.status, 404)

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
assert.ok(document.paths['/registry/search'])
assert.equal(document.paths['/auth/sign-up'], undefined)
assert.equal(document.paths['/auth/session'], undefined)
assert.equal(document.paths['/registry'], undefined)
assert.equal(document.paths['/registry/{sourceId}'], undefined)

assert.equal((await api.request('/auth/session')).status, 404)
assert.equal((await api.request('/registry')).status, 404)

const mounted = mountApi('/api', { fetch: upstreamFetch })
assert.equal((await mounted.request('/api/registry/feed')).status, 200)
assert.equal((await mounted.request('/api/registry/search?q=linear')).status, 503)
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

const rejectedExecute = await client.execute.$post({
  json: {
    specUrl: 'http://localhost:8787/openapi.yaml',
    transport: 'http',
    method: 'post',
    url: 'https://evil.test/widgets',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"local"}',
  },
})
assert.equal(rejectedExecute.status, 400)

const selfExecute = await api.request('/execute', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    specUrl: 'http://localhost/openapi.json',
    transport: 'http',
    method: 'get',
    url: 'http://localhost/registry/feed',
  }),
})
assert.equal(selfExecute.status, 200)
const selfExecuteBody = await selfExecute.json()
assert.equal(selfExecuteBody.status.code, 200)
assert.ok(JSON.parse(selfExecuteBody.body)['MCP Servers'])
assert.equal(
  seen.some(
    (entry) =>
      entry.url.includes('/openapi.json') || entry.url.includes('/registry/feed'),
  ),
  false,
)

console.log('api tests passed')
