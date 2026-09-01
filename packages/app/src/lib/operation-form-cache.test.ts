import assert from 'node:assert/strict'
import { readOperationFormData, writeOperationFormData } from './operation-form-cache.ts'

const session = new Map<string, string>()
Object.defineProperty(globalThis, 'window', {
  value: {
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
    },
  },
  configurable: true,
})

assert.deepEqual(readOperationFormData('api-a', 'operation-a'), {})

const formData = { message: 'keep me' }
writeOperationFormData('api-a', 'operation-a', formData)

assert.equal(readOperationFormData('api-a', 'operation-a'), formData)
assert.deepEqual(
  JSON.parse(session.get('oc:operation-form:api-a:operation-a') ?? ''),
  formData,
)
assert.deepEqual(readOperationFormData('api-a', 'operation-b'), {})
assert.deepEqual(readOperationFormData('api-b', 'operation-a'), {})

session.set(
  'oc:operation-form:api-after-oauth:tool%3Asearch',
  JSON.stringify({ query: 'keep this after OAuth' }),
)
assert.deepEqual(
  readOperationFormData('api-after-oauth', 'tool:search'),
  { query: 'keep this after OAuth' },
)

console.log('operation form cache ok')
