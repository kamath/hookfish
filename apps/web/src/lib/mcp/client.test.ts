import assert from 'node:assert/strict'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { setCloudProxy } from '../cloud'
import { closeMcpConnection, getMcpTrace } from './client'
import { mcpExecutableAdapter } from './executable'
import {
  BrowserMcpOAuthProvider,
  clearMcpOAuth,
  hasMcpOAuthTokens,
  isMcpOAuthCallback,
  mcpOAuthClientMetadata,
  pendingMcpAuthorizationUrl,
} from './oauth'
import { loadMcpSource } from './source'

const browserStorage = new Map<string, string>()
let assignedUrl: string | undefined
const location = {
  origin: 'http://hookfish.test',
  href: 'http://hookfish.test/',
  assign: (url: string | URL) => {
    assignedUrl = String(url)
  },
}
Object.defineProperty(globalThis, 'window', {
  value: {
    location,
    history: {
      state: null,
      replaceState: (_state: unknown, _unused: string, url?: string | URL | null) => {
        if (url) {
          location.href = String(url)
        }
      },
    },
    localStorage: {
      getItem: (key: string) => browserStorage.get(key) ?? null,
      setItem: (key: string, value: string) => browserStorage.set(key, value),
      removeItem: (key: string) => browserStorage.delete(key),
    },
    prompt: () => null,
  },
  configurable: true,
})

type SeenRequest = {
  endpoint: string
  method: string
  headers: Headers
  message?: Record<string, unknown>
}

const seen: SeenRequest[] = []
const initializeCounts = new Map<string, number>()
const invalidSessions = new Map<string, number>()

function result(id: unknown, value: Record<string, unknown>, headers?: HeadersInit) {
  return Response.json(
    {
      jsonrpc: '2.0',
      id,
      result: value,
    },
    { headers },
  )
}

function listResult(id: unknown, key: string, value: unknown[]) {
  return result(id, {
    resultType: 'complete',
    [key]: value,
    ttlMs: 0,
    cacheScope: 'private',
  })
}

globalThis.fetch = async (input, init) => {
  const proxyUrl = new URL(input instanceof Request ? input.url : String(input))
  const endpoint = proxyUrl.searchParams.get('url') ?? proxyUrl.toString()
  const method = init?.method ?? 'GET'
  const headers = new Headers(init?.headers)
  let message: Record<string, unknown> | undefined
  if (typeof init?.body === 'string') {
    try {
      message = JSON.parse(init.body) as Record<string, unknown>
    } catch {
      message = undefined
    }
  }
  seen.push({ endpoint, method, headers, message })

  if (endpoint === 'https://mcp.test/.well-known/oauth-protected-resource') {
    return Response.json({
      resource: 'https://mcp.test/oauth',
      authorization_servers: ['https://auth.test'],
      scopes_supported: ['mcp'],
    })
  }
  if (endpoint === 'https://auth.test/.well-known/oauth-authorization-server') {
    return Response.json({
      issuer: 'https://auth.test',
      authorization_endpoint: 'https://auth.test/authorize',
      token_endpoint: 'https://auth.test/token',
      registration_endpoint: 'https://auth.test/register',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    })
  }
  if (endpoint === 'https://auth.test/register') {
    return Response.json({
      client_id: 'registered-client',
      redirect_uris: ['http://hookfish.test/apis/oauth-flow/routes'],
      token_endpoint_auth_method: 'none',
    })
  }
  if (endpoint === 'https://auth.test/token') {
    return Response.json({
      access_token: 'oauth-access-token',
      token_type: 'bearer',
      scope: 'mcp',
    })
  }
  if (
    endpoint === 'https://mcp.test/oauth' &&
    headers.get('authorization') !== 'Bearer oauth-access-token'
  ) {
    return new Response(null, {
      status: 401,
      headers: {
        'WWW-Authenticate':
          'Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource"',
      },
    })
  }
  if (method === 'GET') {
    return new Response(null, { status: 405, statusText: 'Method Not Allowed' })
  }
  if (method === 'DELETE') {
    return new Response(null, { status: 200 })
  }
  if (!message) {
    return new Response(null, { status: 202 })
  }

  const id = message.id
  const rpcMethod = String(message.method)
  const legacy = endpoint.includes('/legacy')
  const sessionId = headers.get('mcp-session-id')
  const invalidSessionStatus = sessionId
    ? invalidSessions.get(sessionId)
    : undefined
  if (
    invalidSessionStatus &&
    rpcMethod !== 'initialize' &&
    rpcMethod !== 'server/discover'
  ) {
    invalidSessions.delete(sessionId)
    return new Response('Invalid session ID', { status: invalidSessionStatus })
  }
  if (rpcMethod === 'server/discover') {
    if (legacy) {
      return Response.json(
        {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        },
        { status: 404 },
      )
    }
    return result(id, {
      resultType: 'complete',
      supportedVersions: ['2026-07-28'],
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      ttlMs: 0,
      cacheScope: 'public',
      instructions: 'Modern test server',
      _meta: {
        'io.modelcontextprotocol/serverInfo': {
          name: 'modern-test',
          version: '2.0.0',
        },
      },
    })
  }
  if (rpcMethod === 'initialize') {
    initializeCounts.set(endpoint, (initializeCounts.get(endpoint) ?? 0) + 1)
    return result(
      id,
      {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: { name: 'legacy-test', version: '1.0.0' },
        instructions: 'Legacy test server',
      },
      { 'Mcp-Session-Id': 'legacy-session' },
    )
  }
  if (rpcMethod === 'notifications/initialized') {
    return new Response(null, { status: 202 })
  }
  if (rpcMethod === 'tools/list') {
    return listResult(id, 'tools', [
      {
        name: 'echo',
        description: 'Echo input',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', 'x-mcp-header': 'Text' },
          },
          required: ['text'],
        },
      },
    ])
  }
  if (rpcMethod === 'resources/list') {
    return listResult(id, 'resources', [
      { uri: 'test://fixed', name: 'Fixed resource' },
    ])
  }
  if (rpcMethod === 'resources/templates/list') {
    return listResult(id, 'resourceTemplates', [
      { uriTemplate: 'test://items/{id}', name: 'Item' },
    ])
  }
  if (rpcMethod === 'prompts/list') {
    return listResult(id, 'prompts', [
      {
        name: 'hello',
        arguments: [{ name: 'name', required: true }],
      },
    ])
  }
  if (rpcMethod === 'tools/call') {
    const params = message.params as Record<string, unknown>
    if (!params.inputResponses) {
      return result(id, {
        resultType: 'input_required',
        inputRequests: {
          approval: {
            jsonrpc: '2.0',
            id: 'approval',
            method: 'elicitation/create',
            params: {
              mode: 'form',
              message: 'Approve this test call?',
              requestedSchema: {
                type: 'object',
                properties: { approved: { type: 'boolean' } },
              },
            },
          },
        },
        requestState: 'opaque-test-state',
      })
    }
    return result(id, {
      resultType: 'complete',
      content: [{ type: 'text', text: 'hello' }],
    })
  }
  throw new Error(`Unexpected MCP method: ${rpcMethod}`)
}

const modern = await loadMcpSource('https://mcp.test/modern', 'modern', {})
assert.equal(modern.title, 'modern-test')
assert.equal(modern.executables.length, 4)
assert.equal(
  (modern.adapterData as { era: string }).era,
  'modern',
)
const tool = modern.executables.find((item) => item.id === 'tool:echo')
assert.ok(tool)
const invocation = mcpExecutableAdapter.buildInvocation({
  source: modern,
  executable: tool,
  target: modern.targets[0] ?? '',
  formData: { text: 'hello' },
  credentials: {
    bearerToken: 'must-not-be-forwarded',
    headers: '{"X-Test":"must-not-be-forwarded"}',
  },
})
const execution = await mcpExecutableAdapter.execute(invocation)
assert.ok(execution.inputRequired)
assert.ok(execution.trace?.some((entry) => entry.summary === 'tools/call'))
const modernTrace = getMcpTrace('modern')
assert.ok(
  modernTrace.some(
    (entry) => entry.summary === 'initialize' || entry.summary === 'server/discover',
  ),
)
assert.ok(modernTrace.some((entry) => entry.summary === 'tools/list'))
assert.ok(modernTrace.some((entry) => entry.summary === 'tools/call'))
assert.ok(modernTrace.length > (execution.trace?.length ?? 0))
const modernCall = seen.find(
  (request) =>
    request.endpoint.includes('/modern') && request.message?.method === 'tools/call',
)
assert.equal(modernCall?.headers.get('mcp-protocol-version'), '2026-07-28')
assert.equal(modernCall?.headers.get('mcp-method'), 'tools/call')
assert.equal(modernCall?.headers.get('mcp-name'), 'echo')
assert.equal(modernCall?.headers.get('mcp-param-text'), 'hello')
assert.equal(modernCall?.headers.get('authorization'), null)
assert.equal(modernCall?.headers.get('x-test'), null)
assert.ok(mcpExecutableAdapter.continue)
const continued = await mcpExecutableAdapter.continue(
  invocation,
  {
    approval: {
      jsonrpc: '2.0',
      id: 'approval',
      result: { action: 'accept', content: { approved: true } },
    },
  },
  execution.inputRequired.requestState,
)
assert.match(continued.body, /hello/)

const legacy = await loadMcpSource('https://mcp.test/legacy', 'legacy', {})
assert.equal(legacy.title, 'legacy-test')
assert.equal((legacy.adapterData as { era: string }).era, 'legacy')
assert.equal(
  (legacy.adapterData as { protocolVersion: string }).protocolVersion,
  '2025-03-26',
)
assert.ok(
  seen.some(
    (request) =>
      request.endpoint.includes('/legacy') &&
      request.message?.method === 'tools/list' &&
      request.headers.get('mcp-session-id') === 'legacy-session',
  ),
)
invalidSessions.set('legacy-session', 404)
const recoveredLegacy = await loadMcpSource(
  'https://mcp.test/legacy',
  'legacy',
  {},
)
assert.equal(recoveredLegacy.title, 'legacy-test')
assert.equal(initializeCounts.get('https://mcp.test/legacy'), 2)

const legacyTool = recoveredLegacy.executables.find(
  (item) => item.id === 'tool:echo',
)
assert.ok(legacyTool)
const legacyInvocation = mcpExecutableAdapter.buildInvocation({
  source: recoveredLegacy,
  executable: legacyTool,
  target: recoveredLegacy.targets[0] ?? '',
  formData: { text: 'recover' },
  credentials: {},
})
invalidSessions.set('legacy-session', 400)
const recoveredExecution =
  await mcpExecutableAdapter.execute(legacyInvocation)
assert.ok(recoveredExecution.inputRequired)
assert.equal(initializeCounts.get('https://mcp.test/legacy'), 3)

await assert.rejects(
  loadMcpSource('https://mcp.test/oauth', 'oauth-flow', {}),
  (error) => UnauthorizedError.isInstance(error),
)
assert.equal(assignedUrl, undefined)
const pendingUrl = pendingMcpAuthorizationUrl()
assert.ok(pendingUrl)
const authorizationUrl = new URL(pendingUrl)
assert.equal(authorizationUrl.origin, 'https://auth.test')
assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256')
const authorizationState = authorizationUrl.searchParams.get('state')
assert.ok(authorizationState)
location.href = `http://hookfish.test/apis/oauth-flow/routes?code=oauth-code&state=${authorizationState}`
assert.equal(isMcpOAuthCallback(), true)
const oauthSource = await loadMcpSource('https://mcp.test/oauth', 'oauth-flow', {})
assert.equal(oauthSource.title, 'modern-test')
assert.equal(pendingMcpAuthorizationUrl(), undefined)
assert.equal(isMcpOAuthCallback(), false)
assert.equal(
  (oauthSource.adapterData as { oauthAuthorized: boolean }).oauthAuthorized,
  true,
)
assert.ok(
  seen.some(
    (request) =>
      request.endpoint === 'https://mcp.test/oauth' &&
      request.headers.get('authorization') === 'Bearer oauth-access-token',
  ),
)

const oauth = new BrowserMcpOAuthProvider('oauth-source')
const oauthState = oauth.state()
oauth.saveCodeVerifier('test-verifier')
oauth.saveClientInformation(
  { client_id: 'test-client', issuer: 'https://auth.test' },
  { issuer: 'https://auth.test' },
)
oauth.saveTokens(
  {
    access_token: 'test-access-token',
    token_type: 'bearer',
    issuer: 'https://auth.test',
  },
  { issuer: 'https://auth.test' },
)
assert.equal(oauth.codeVerifier(), 'test-verifier')
assert.equal(oauth.tokens()?.access_token, 'test-access-token')
assert.equal(hasMcpOAuthTokens('oauth-source'), true)
location.href = `http://hookfish.test/apis/oauth-source/routes?code=test-code&state=${oauthState}`
assert.equal(oauth.callbackParameters()?.get('code'), 'test-code')
oauth.finishCallback()
oauth.cleanCallbackUrl()
assert.equal(location.href, 'http://hookfish.test/apis/oauth-source/routes')
assert.throws(() => oauth.codeVerifier(), /verifier is missing/)
assert.deepEqual(mcpOAuthClientMetadata('oauth-source', 'https://hookfish.test'), {
  client_name: 'Hookfish MCP Inspector',
  client_uri: 'https://hookfish.test',
  redirect_uris: ['https://hookfish.test/apis/oauth-source/routes'],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_method: 'none',
})
clearMcpOAuth('oauth-source')
assert.equal(hasMcpOAuthTokens('oauth-source'), false)

await closeMcpConnection('modern')
assert.deepEqual(getMcpTrace('modern'), [])
await closeMcpConnection('legacy')
await closeMcpConnection('oauth-flow')
clearMcpOAuth('oauth-flow')

setCloudProxy(false)
const directStart = seen.length
await loadMcpSource('http://localhost:8787/modern', 'direct', {})
assert.ok(
  seen.slice(directStart).some((request) => request.endpoint.includes('localhost:8787/modern')),
)
assert.ok(
  seen
    .slice(directStart)
    .every((request) => !request.endpoint.includes('/api/mcp-proxy')),
)
await closeMcpConnection('direct')
setCloudProxy(true)

console.log('mcp modern, legacy SHTTP, OAuth, and direct-browser transport ok')
