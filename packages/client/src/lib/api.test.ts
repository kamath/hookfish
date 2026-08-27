import assert from 'node:assert/strict'
import {
  DEFAULT_API_BASE_URL,
  configureApiBaseUrl,
  getApi,
  getApiBaseUrl,
  getConfiguredApiBaseUrl,
  isOwnOpenApiUrl,
} from './api'

Object.defineProperty(globalThis, 'window', {
  value: { location: { origin: 'https://hookfish.test' } },
  configurable: true,
})

assert.equal(DEFAULT_API_BASE_URL, '/api')
assert.equal(getConfiguredApiBaseUrl(), '/api')
assert.equal(getApiBaseUrl(), 'https://hookfish.test/api')
assert.equal(
  getApi()['mcp-proxy'].$url({ query: { url: 'https://mcp.test' } }).toString(),
  'https://hookfish.test/api/mcp-proxy?url=https%3A%2F%2Fmcp.test',
)
assert.equal(
  getApi()['mcp-oauth-client'].$url({ query: { sourceId: 'abc' } }).toString(),
  'https://hookfish.test/api/mcp-oauth-client?sourceId=abc',
)
assert.equal(
  getApi()['openapi.json'].$url().toString(),
  'https://hookfish.test/api/openapi.json',
)

assert.equal(isOwnOpenApiUrl('/api/openapi.json'), true)
assert.equal(isOwnOpenApiUrl('https://hookfish.test/api/openapi.json'), true)
assert.equal(isOwnOpenApiUrl('https://petstore3.swagger.io/api/v3/openapi.json'), false)

configureApiBaseUrl('/backend/')
assert.equal(getConfiguredApiBaseUrl(), '/backend')
assert.equal(getApiBaseUrl(), 'https://hookfish.test/backend')
assert.equal(isOwnOpenApiUrl('/backend/openapi.json'), true)

console.log('api client tests passed')
