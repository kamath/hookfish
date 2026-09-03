import assert from 'node:assert/strict'
import { apiMountPrefix, isOwnOpenApiUrl, ownApiPath, ownApiRequest } from './self'

assert.equal(apiMountPrefix('http://localhost/api/spec'), '/api')
assert.equal(apiMountPrefix('http://localhost/spec'), '')
assert.equal(ownApiPath('http://localhost/api/openapi.json', 'http://localhost/api/spec'), '/openapi.json')
assert.equal(ownApiPath('/api/openapi.json', 'http://localhost/api/spec'), '/openapi.json')
assert.equal(ownApiPath('http://localhost/openapi.json', 'http://localhost/spec'), '/openapi.json')
assert.equal(ownApiPath('http://localhost/other/openapi.json', 'http://localhost/api/spec'), undefined)
assert.equal(ownApiPath('https://example.com/api/openapi.json', 'http://localhost/api/spec'), undefined)
assert.equal(isOwnOpenApiUrl('http://localhost/api/openapi.json', 'http://localhost/api/spec'), true)
assert.equal(isOwnOpenApiUrl('/api/openapi.json', 'http://localhost/api/spec'), true)
assert.equal(isOwnOpenApiUrl('http://localhost/openapi.json', 'http://localhost/api/spec'), false)
assert.equal(isOwnOpenApiUrl('https://petstore3.swagger.io/api/v3/openapi.json', 'http://localhost/api/spec'), false)

const rewritten = ownApiRequest(
  'http://localhost/api/openapi.json',
  { method: 'GET' },
  'http://localhost/api/execute',
)
assert.ok(rewritten)
assert.equal(new URL(rewritten.url).pathname, '/openapi.json')
assert.equal(rewritten.method, 'GET')

console.log('self-url tests passed')
