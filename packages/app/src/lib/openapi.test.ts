import assert from 'node:assert/strict'
import { isOpenApiDocument, specToClient } from './openapi.ts'

assert.equal(isOpenApiDocument({ openapi: '3.1.0', paths: {} }), true)
assert.equal(isOpenApiDocument({ swagger: '2.0', info: { title: 'S' } }), true)
assert.equal(
  isOpenApiDocument({ info: { title: 'No version field' }, paths: { '/x': {} } }),
  true,
)
assert.equal(isOpenApiDocument({ paths: { '/x': {} } }), false)
assert.equal(isOpenApiDocument({ jsonrpc: '2.0', result: {} }), false)
assert.equal(isOpenApiDocument('openapi: 3.1.0'), false)
assert.equal(isOpenApiDocument(null), false)

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

assert.throws(
  () => specToClient({ jsonrpc: '2.0', result: {} }, 'https://example.test/rpc', 'rpc'),
  /OpenAPI or Swagger document/,
)

const swaggerUpload = specToClient(
  {
    swagger: '2.0',
    info: { title: 'Pets', version: '1' },
    paths: {
      '/pet/{petId}/uploadImage': {
        post: {
          operationId: 'uploadFile',
          parameters: [
            { name: 'petId', in: 'path', required: true, type: 'integer' },
            {
              name: 'additionalMetadata',
              in: 'formData',
              type: 'string',
              description: 'Additional data to pass to server.',
            },
            {
              name: 'file',
              in: 'formData',
              type: 'file',
              description: 'file to upload',
            },
          ],
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  },
  'https://example.test/swagger.json',
  'pets',
)

const file = (
  swaggerUpload.executables[0]?.inputSchema as {
    properties?: {
      body?: {
        properties?: {
          file?: {
            type?: unknown
            format?: unknown
            title?: unknown
            description?: unknown
          }
        }
      }
    }
  }
).properties?.body?.properties?.file
assert.equal(file?.type, 'string')
assert.equal(file?.format, 'binary')
assert.equal(file?.title, 'file')
assert.equal(file?.description, 'file to upload')

console.log('openapi output schema ok')
