import assert from 'node:assert/strict'
import type { JsonSchema } from './client-types'
import { validatorForSchema } from './form-validator'

const draft2020Schema: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    creditCard: { type: 'string' },
    billingAddress: { type: 'string' },
  },
  dependentRequired: {
    creditCard: ['billingAddress'],
  },
}

const validator = validatorForSchema(draft2020Schema)
const invalid = validator.validateFormData({ creditCard: '1234' }, draft2020Schema as never)
assert.equal(invalid.errors.length, 1)
assert.match(invalid.errors[0]?.name ?? '', /dependentRequired/)

const valid = validator.validateFormData(
  { creditCard: '1234', billingAddress: 'Main Street' },
  draft2020Schema as never,
)
assert.equal(valid.errors.length, 0)

console.log('JSON Schema 2020-12 form validation ok')
