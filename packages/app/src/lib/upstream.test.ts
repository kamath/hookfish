import assert from 'node:assert/strict'
import {
  assertNotProxyBlocked,
  CorsError,
  findCause,
  localUpstreamFetch,
  ProxyBlockedError,
} from './upstream'

await assert.rejects(
  () =>
    localUpstreamFetch('https://cross-origin.test', undefined, async () => {
      throw new TypeError('Failed to fetch')
    }),
  (error) => error instanceof CorsError && /Likely CORS error\. Cloud mode may help\./.test(error.message),
)

assert.ok(findCause(new Error('wrapped', { cause: new CorsError('cors') }), CorsError))
assert.equal(findCause(new Error('plain'), CorsError), undefined)

assert.throws(
  () =>
    assertNotProxyBlocked(
      new Response('<!DOCTYPE html>', { status: 403, headers: { 'content-type': 'text/html' } }),
      'https://mcp.example.test/mcp',
    ),
  (error) => error instanceof ProxyBlockedError && error.message.startsWith('mcp.example.test blocked'),
)
assertNotProxyBlocked(
  new Response('{}', { status: 403, headers: { 'content-type': 'application/json' } }),
  'https://mcp.example.test/mcp',
)

await assert.rejects(
  () =>
    localUpstreamFetch('https://slow.test', undefined, async () => {
      throw new DOMException('Timed out', 'TimeoutError')
    }),
  (error) => error instanceof DOMException && !error.message.includes('CORS'),
)

console.log('upstream tests passed')
