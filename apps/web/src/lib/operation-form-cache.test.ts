import assert from 'node:assert/strict'
import { readOperationFormData, writeOperationFormData } from './operation-form-cache.ts'

assert.deepEqual(readOperationFormData('api-a', 'operation-a'), {})

const formData = { message: 'keep me' }
writeOperationFormData('api-a', 'operation-a', formData)

assert.equal(readOperationFormData('api-a', 'operation-a'), formData)
assert.deepEqual(readOperationFormData('api-a', 'operation-b'), {})
assert.deepEqual(readOperationFormData('api-b', 'operation-a'), {})

console.log('operation form cache ok')
