import assert from 'node:assert/strict'
import { clientAddress, createMemoryRateLimit } from './rate-limit'

assert.equal(
  clientAddress(new Request('http://test', { headers: { 'cf-connecting-ip': '1.2.3.4' } })),
  '1.2.3.4',
)
assert.equal(
  clientAddress(
    new Request('http://test', { headers: { 'x-forwarded-for': '8.8.8.8, 9.9.9.9' } }),
  ),
  '8.8.8.8',
)
assert.equal(clientAddress(new Request('http://test')), 'unknown')

const limit = createMemoryRateLimit({ spec: 2, execute: 1, 'mcp-proxy': 1 }, 60_000)
const spec = new Request('http://test', { headers: { 'cf-connecting-ip': '10.0.0.1' } })
const other = new Request('http://test', { headers: { 'cf-connecting-ip': '10.0.0.2' } })

assert.equal(limit({ request: spec, route: 'spec' }), true)
assert.equal(limit({ request: spec, route: 'spec' }), true)
assert.equal(limit({ request: spec, route: 'spec' }), false)
assert.equal(limit({ request: spec, route: 'execute' }), true)
assert.equal(limit({ request: other, route: 'spec' }), true)

const short = createMemoryRateLimit({ spec: 1 }, 20)
const once = new Request('http://test', { headers: { 'cf-connecting-ip': '10.0.0.3' } })
assert.equal(short({ request: once, route: 'spec' }), true)
assert.equal(short({ request: once, route: 'spec' }), false)
await new Promise((resolve) => setTimeout(resolve, 25))
assert.equal(short({ request: once, route: 'spec' }), true)

console.log('rate limit tests passed')
