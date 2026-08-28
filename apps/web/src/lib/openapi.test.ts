import assert from 'node:assert/strict'
import { specToClient } from './openapi.ts'

const api = specToClient(
  {
    openapi: '3.1.0',
    info: { title: 'Test', version: '1' },
    paths: {
      '/items': {
        get: {
          description: 'Lists items.',
          responses: {
            200: {
              description: 'Items.',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
  'https://example.test/openapi.json',
  'test',
)

assert.equal(api.executables[0]?.description, 'Lists items.')
assert.deepEqual(api.executables[0]?.outputSchema, {
  type: 'object',
  title: 'Responses',
  properties: {
    200: {
      type: 'array',
      items: { type: 'string' },
      description: 'Items.',
    },
  },
})

console.log('openapi output schema ok')
