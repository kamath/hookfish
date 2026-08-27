import assert from 'node:assert/strict'
import { specToClient } from './openapi.ts'

const spec = {
  openapi: '3.1.0',
  info: { title: 'Pets', version: '1.0.0' },
  paths: {
    '/pets/{id}': {
      get: {
        operationId: 'getPet',
        summary: 'Get a pet',
        description: 'Returns one pet by id.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'A pet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                  required: ['id', 'name'],
                },
              },
            },
          },
          '404': {
            description: 'Missing pet.',
          },
        },
      },
    },
  },
}

const api = specToClient(spec, 'https://pets.test/openapi.json', 'pets')
const operation = api.executables.find((item) => item.id === 'getPet')
assert.ok(operation)
assert.equal(operation.description, 'Returns one pet by id.')
assert.deepEqual(operation.outputSchema, {
  type: 'object',
  title: 'Responses',
  properties: {
    '200': {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
      description: 'A pet.',
    },
    '404': {
      description: 'Missing pet.',
    },
  },
})

console.log('openapi output schema ok')
