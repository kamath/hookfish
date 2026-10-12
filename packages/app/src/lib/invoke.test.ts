import assert from 'node:assert/strict'
import type { Executable } from './client-types.ts'
import { buildOperationRequest } from './invoke.ts'

const operation: Executable = {
  id: 'get-pets',
  name: 'GET /pets',
  badge: 'GET',
  accent: '',
  groups: [],
  binding: { type: 'http', method: 'get', path: '/pets' },
  inputSchema: {},
  inputUiSchema: {},
}

const request = buildOperationRequest({
  specUrl: 'https://pets.test/openapi.json',
  serverUrl: 'https://pets.test',
  operation,
  formData: { header: { 'X-Trace': 'from-form' } },
  auth: { bearer: 'scheme-token' },
  authSchemes: [{ name: 'bearer', type: 'http', scheme: 'bearer' }],
  defaultHeaders: {
    'X-Api-Key': 'key-1',
    'X-Trace': 'from-source',
    Authorization: 'Bearer source-token',
  },
})
assert.equal(request.headers?.['x-api-key'], 'key-1')
assert.equal(request.headers?.['x-trace'], 'from-form')
assert.equal(request.headers?.authorization, 'Bearer scheme-token')

const withoutDefaults = buildOperationRequest({
  specUrl: 'https://pets.test/openapi.json',
  serverUrl: 'https://pets.test',
  operation,
  formData: {},
  auth: {},
  authSchemes: [],
})
assert.deepEqual(withoutDefaults.headers, {})

console.log('invoke ok')
