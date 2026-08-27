import Ajv2020 from 'ajv/dist/2020.js'
import defaultValidator, { customizeValidator } from '@rjsf/validator-ajv8'
import type { JsonSchema } from './client-types'

const draft2020Validator = customizeValidator({ AjvClass: Ajv2020 })

export function validatorForSchema(schema: JsonSchema) {
  return schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
    ? draft2020Validator
    : defaultValidator
}
