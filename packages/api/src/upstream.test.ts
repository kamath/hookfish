import assert from 'node:assert/strict'
import { executeUpstreamRequest, fetchUpstreamSpec } from './upstream'

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
assert.match(
  String(new Headers(seen[0]?.init?.headers).get('accept')),
  /application\/json/,
)
assert.equal(
  String(new Headers(seen[0]?.init?.headers).get('accept')).includes('*/*'),
  false,
  'spec fetch must not accept event streams via */*',
)

{
  let cancelled = false
  const sseFetch: typeof fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: ping\n\n'))
        },
        cancel() {
          cancelled = true
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    )
  await assert.rejects(
    () => fetchUpstreamSpec('http://localhost:8787/mcp', sseFetch),
    /event stream/,
  )
  assert.equal(cancelled, true, 'SSE body is cancelled instead of being consumed')
}

{
  let cancelled = false
  const oversizedFetch: typeof fetch = async () =>
    new Response(
      new ReadableStream({
        cancel() {
          cancelled = true
        },
      }),
      { headers: { 'content-length': '16000001' } },
    )
  await assert.rejects(
    () => fetchUpstreamSpec('http://localhost:8787/oversized.json', oversizedFetch),
    /larger than 16 MB/,
  )
  assert.equal(cancelled, true, 'an oversized declared body is cancelled before reading')
}

{
  let pulls = 0
  let cancelled = false
  const oversizedStreamFetch: typeof fetch = async () =>
    new Response(
      new ReadableStream(
        {
          pull(controller) {
            pulls += 1
            controller.enqueue(new Uint8Array(8_000_001))
          },
          cancel() {
            cancelled = true
          },
        },
        { highWaterMark: 0 },
      ),
    )
  await assert.rejects(
    () => fetchUpstreamSpec('http://localhost:8787/stream.json', oversizedStreamFetch),
    /larger than 16 MB/,
  )
  assert.equal(pulls, 2, 'streaming reads stop as soon as the byte limit is exceeded')
  assert.equal(cancelled, true, 'an oversized streaming body is cancelled')
}

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
assert.equal(result.status.code, 201)
assert.equal(result.body, '{"ok":true}')
assert.deepEqual(
  result.details.items.find((item) => item.name === 'x-upstream'),
  { name: 'x-upstream', value: 'direct' },
)

await assert.rejects(
  () => fetchUpstreamSpec('file:///tmp/openapi.yaml', upstreamFetch),
  /http or https OpenAPI URL/,
)

console.log('upstream tests passed')
