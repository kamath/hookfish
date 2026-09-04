import assert from 'node:assert/strict'
import {
  assertMcpProxyRequest,
  isMcpJsonRpcBody,
  isOAuthProtocolBody,
} from './mcp'

assert.equal(
  isMcpJsonRpcBody(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })),
  true,
)
assert.equal(
  isMcpJsonRpcBody(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  ),
  true,
)
assert.equal(
  isMcpJsonRpcBody(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } })),
  true,
)
assert.equal(
  isMcpJsonRpcBody(
    JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { jsonrpc: '2.0', method: 'notifications/cancelled' },
    ]),
  ),
  true,
)
assert.equal(isMcpJsonRpcBody('{"ok":true}'), false)
assert.equal(isMcpJsonRpcBody('not-json'), false)
assert.equal(
  isMcpJsonRpcBody(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {}, error: {} })),
  false,
)

assert.equal(
  isOAuthProtocolBody(
    'application/x-www-form-urlencoded',
    'grant_type=authorization_code&code=abc',
  ),
  true,
)
assert.equal(
  isOAuthProtocolBody(
    'application/json',
    JSON.stringify({ redirect_uris: ['https://app.test/callback'] }),
  ),
  true,
)
assert.equal(isOAuthProtocolBody('application/json', '{"name":"local"}'), false)

assert.doesNotThrow(() =>
  assertMcpProxyRequest({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call' }),
  }),
)
assert.doesNotThrow(() =>
  assertMcpProxyRequest({
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    body: 'grant_type=refresh_token',
  }),
)
assert.doesNotThrow(() => assertMcpProxyRequest({ method: 'GET' }))
assert.doesNotThrow(() => assertMcpProxyRequest({ method: 'DELETE' }))

assert.throws(
  () =>
    assertMcpProxyRequest({
      method: 'POST',
      contentType: 'application/json',
      body: '{"url":"https://evil.test"}',
    }),
  /does not match the MCP protocol/,
)
assert.throws(
  () => assertMcpProxyRequest({ method: 'PUT', body: '' }),
  /GET, POST, and DELETE/,
)
assert.throws(
  () => assertMcpProxyRequest({ method: 'GET', body: '{"jsonrpc":"2.0"}' }),
  /cannot include a body/,
)

console.log('mcp protocol tests passed')
