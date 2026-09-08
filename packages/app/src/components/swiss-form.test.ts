import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { validatorForSchema } from '../lib/form-validator.ts'
import {
  FILE_UPLOAD_NOTICE,
  isFileUploadSchema,
  SwissForm,
} from './swiss-form.tsx'

assert.equal(isFileUploadSchema({ type: 'file' }), true)
assert.equal(isFileUploadSchema({ type: 'string', format: 'binary' }), true)
assert.equal(isFileUploadSchema({ type: 'string', format: 'byte' }), true)
assert.equal(isFileUploadSchema({ type: ['file', 'null'] }), true)
assert.equal(isFileUploadSchema({ type: 'string' }), false)

function render(schema: Record<string, unknown>) {
  return renderToString(
    createElement(SwissForm, {
      schema,
      validator: validatorForSchema(schema),
    }),
  )
}

const upload = render({
  type: 'object',
  properties: {
    additionalMetadata: {
      type: 'string',
      title: 'additionalMetadata',
      description: 'Additional data to pass to server.',
    },
    file: {
      type: 'file',
      title: 'file',
      description: 'file to upload',
    },
  },
})

assert.match(upload, /additionalMetadata/)
assert.match(upload, /Additional data to pass to server/)
assert.match(upload, new RegExp(FILE_UPLOAD_NOTICE))
assert.doesNotMatch(upload, /Unknown field type file/)
assert.doesNotMatch(upload, /Unsupported field schema/)

const binary = render({
  type: 'object',
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      title: 'file',
      description: 'file to upload',
    },
  },
})

assert.match(binary, new RegExp(FILE_UPLOAD_NOTICE))
assert.match(binary, />file</)
assert.doesNotMatch(binary, /type="text"/)

const other = render({
  type: 'object',
  properties: {
    weird: { type: 'mystery', title: 'weird' },
  },
})

assert.match(other, /This field is not supported/)
assert.doesNotMatch(other, new RegExp(FILE_UPLOAD_NOTICE))

console.log('swiss form file upload notice ok')
