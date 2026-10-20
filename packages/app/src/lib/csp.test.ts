import assert from 'node:assert/strict'
import { contentSecurityPolicy, createCspNonce } from './csp'

const first = createCspNonce()
const second = createCspNonce()
assert.match(first, /^[A-Za-z0-9+/]{22}==$/, 'a nonce is 16 random bytes in base64')
assert.notEqual(first, second, 'every response gets its own nonce')

const directives = new Map(
  contentSecurityPolicy(first)
    .split('; ')
    .map((directive) => {
      const [name, ...values] = directive.split(' ')
      return [name, values] as const
    }),
)
const scripts = directives.get('script-src') ?? []
assert.ok(scripts.includes(`'nonce-${first}'`))
assert.ok(scripts.includes("'strict-dynamic'"))
assert.ok(!scripts.includes("'unsafe-inline'"), 'injected inline scripts never run')
assert.deepEqual(directives.get('object-src'), ["'none'"])
assert.deepEqual(directives.get('base-uri'), ["'none'"])
assert.deepEqual(directives.get('frame-ancestors'), ["'none'"])
assert.deepEqual(directives.get('frame-src'), ["'self'"], 'MCP App views load from the API frame')

console.log('csp tests passed')
