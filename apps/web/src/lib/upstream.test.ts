import assert from 'node:assert/strict'
import {
  executeUpstreamRequest,
  fetchUpstreamSpec,
  localUpstreamFetch,
} from './upstream'

const seen: Array<{ url: string; init?: RequestInit }> = []
const upstreamFetch: typeof fetch = async (input, init) => {
  seen.push({ url: String(input), init })
  if (String(input).endsWith('.yaml')) {
    return new Response('openapi: 3.1.0\ninfo:\n  title: Local API')
  }
  return new Response('{"ok":true}', {
    status: 201,
    statusText: 'Created',
    headers: { 'x-upstream': 'direct' },
  })
}

assert.deepEqual(
  await fetchUpstreamSpec('http://localhost:8787/openapi.yaml', upstreamFetch),
  {
    openapi: '3.1.0',
    info: { title: 'Local API' },
  },
)

const result = await executeUpstreamRequest(
  {
    transport: 'http',
    method: 'post',
    url: 'http://localhost:8787/widgets',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"local"}',
  },
  upstreamFetch,
)

assert.equal(seen[1]?.url, 'http://localhost:8787/widgets')
assert.equal(seen[1]?.init?.method, 'POST')
assert.equal(seen[1]?.init?.body, '{"name":"local"}')
assert.equal(result.status?.code, 201)
assert.equal(result.body, '{"ok":true}')
assert.deepEqual(
  result.details?.items.find((item) => item.name === 'x-upstream'),
  { name: 'x-upstream', value: 'direct' },
)

await assert.rejects(
  () => fetchUpstreamSpec('file:///tmp/openapi.yaml', upstreamFetch),
  /http or https OpenAPI URL/,
)

await assert.rejects(
  () =>
    localUpstreamFetch('https://cross-origin.test', undefined, async () => {
      throw new TypeError('Failed to fetch')
    }),
  /Likely CORS error\. Cloud mode may help\./,
)

await assert.rejects(
  () =>
    localUpstreamFetch('https://slow.test', undefined, async () => {
      throw new DOMException('Timed out', 'TimeoutError')
    }),
  (error) => error instanceof DOMException && !error.message.includes('CORS'),
)

console.log('upstream tests passed')
