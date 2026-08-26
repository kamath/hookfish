import assert from 'node:assert/strict'
import { closeMcpConnection } from './client'
import { mcpExecutableAdapter } from './executable'
import { loadMcpSource } from './source'

Object.defineProperty(globalThis, 'window', {
  value: {
    location: { origin: 'http://hookfish.test' },
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
  const endpoint = proxyUrl.searchParams.get('url') ?? ''
  const method = init?.method ?? 'GET'
  const headers = new Headers(init?.headers)
  const message =
    typeof init?.body === 'string'
      ? (JSON.parse(init.body) as Record<string, unknown>)
      : undefined
  seen.push({ endpoint, method, headers, message })

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

await closeMcpConnection('modern')
await closeMcpConnection('legacy')
console.log('mcp modern and legacy SHTTP ok')
