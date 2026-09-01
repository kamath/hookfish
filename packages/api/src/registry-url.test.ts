import assert from 'node:assert/strict'
import { registryUrl } from './registry-url'

assert.deepEqual(registryUrl('https://api.example.com/openapi.json'), {
  eligible: true,
  sourceUrl: 'https://api.example.com/openapi.json',
})
assert.equal(registryUrl('http://api.example.com/openapi.json').eligible, false)
assert.deepEqual(registryUrl('https://localhost:8787/mcp'), {
  eligible: false,
  reason: 'non-public-url',
})
assert.deepEqual(registryUrl('https://192.168.1.10/mcp'), {
  eligible: false,
  reason: 'non-public-url',
})
assert.deepEqual(registryUrl('https://[::1]/mcp'), {
  eligible: false,
  reason: 'non-public-url',
})
assert.deepEqual(registryUrl('https://user:password@api.example.com/mcp'), {
  eligible: false,
  reason: 'credential-bearing-url',
})
assert.deepEqual(registryUrl('https://api.example.com/mcp?token=secret'), {
  eligible: false,
  reason: 'credential-bearing-url',
})
assert.deepEqual(registryUrl('not a URL'), {
  eligible: false,
  reason: 'invalid-url',
})

console.log('registry URL tests passed')
