import assert from 'node:assert/strict'
import { API_BASE_URL, getApi, getApiBaseUrl } from './api'

Object.defineProperty(globalThis, 'window', {
  value: { location: { origin: 'https://hookfish.test' } },
  configurable: true,
})

assert.equal(API_BASE_URL, '/api')
assert.equal(getApiBaseUrl(), 'https://hookfish.test/api')
assert.equal(
  getApi()['mcp-proxy'].$url({ query: { url: 'https://mcp.test' } }).toString(),
  'https://hookfish.test/api/mcp-proxy?url=https%3A%2F%2Fmcp.test',
)
assert.equal(
  getApi()['mcp-oauth-client'].$url({ query: { sourceId: 'abc' } }).toString(),
  'https://hookfish.test/api/mcp-oauth-client?sourceId=abc',
)

console.log('api client tests passed')
