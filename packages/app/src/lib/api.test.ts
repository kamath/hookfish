import assert from 'node:assert/strict'
import { configureApp } from '../config'
import { API_BASE_URL, getApi, getApiBaseUrl, isOwnOpenApiUrl } from './api'

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
assert.equal(
  getApi()['openapi.json'].$url().toString(),
  'https://hookfish.test/api/openapi.json',
)
assert.equal(
  getApi().auth.session.$url().toString(),
  'https://hookfish.test/api/auth/session',
)
assert.equal(
  getApi().auth['sign-in'].$url().toString(),
  'https://hookfish.test/api/auth/sign-in',
)
assert.equal(
  getApi().auth['api-keys'].$url().toString(),
  'https://hookfish.test/api/auth/api-keys',
)

assert.equal(isOwnOpenApiUrl('/api/openapi.json'), true)
assert.equal(isOwnOpenApiUrl('https://hookfish.test/api/openapi.json'), true)
assert.equal(isOwnOpenApiUrl('https://petstore3.swagger.io/api/v3/openapi.json'), false)

configureApp({ apiBaseUrl: 'https://backend.test/v1/' })
assert.equal(getApiBaseUrl(), 'https://backend.test/v1')
assert.equal(
  getApi()['openapi.json'].$url().toString(),
  'https://backend.test/v1/openapi.json',
)
assert.equal(isOwnOpenApiUrl('https://backend.test/v1/openapi.json'), true)
configureApp({})

console.log('api client tests passed')
