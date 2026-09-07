import assert from 'node:assert/strict'
import { buildOperationRequest } from './invoke.ts'
import { applyAuth, isOpenApiDocument, specToClient } from './openapi.ts'

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

const uploadApi = specToClient(
  {
    openapi: '3.0.4',
    info: { title: 'Upload API', version: '1' },
    servers: [{ url: 'https://uploads.example.test' }],
    paths: {
      '/files/{id}': {
        post: {
          operationId: 'uploadFile',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          responses: { 200: { description: 'Uploaded' } },
        },
      },
    },
  },
  'https://uploads.example.test/openapi.json',
  'uploads',
)
const upload = uploadApi.executables[0]!
assert.deepEqual(upload.binding, {
  type: 'http',
  method: 'post',
  path: '/files/{id}',
  contentType: 'application/octet-stream',
  bodyEncoding: 'binary',
})
assert.deepEqual(upload.inputUiSchema.body, { 'ui:widget': 'file' })
assert.deepEqual(
  buildOperationRequest({
    specUrl: uploadApi.sourceUrl,
    serverUrl: uploadApi.targets[0]!,
    operation: upload,
    formData: {
      path: { id: 7 },
      body: 'data:application/octet-stream;name=tiny.bin;base64,AAEC',
    },
    auth: {},
    authSchemes: [],
  }),
  {
    specUrl: 'https://uploads.example.test/openapi.json',
    transport: 'http',
    method: 'POST',
    url: 'https://uploads.example.test/files/7',
    headers: { 'content-type': 'application/octet-stream' },
    body: { kind: 'binary', data: 'AAEC' },
  },
)

const multipartApi = specToClient(
  {
    swagger: '2.0',
    info: { title: 'Multipart API', version: '1' },
    host: 'uploads.example.test',
    basePath: '/v2',
    schemes: ['https'],
    paths: {
      '/files': {
        post: {
          operationId: 'uploadMultipart',
          consumes: ['multipart/form-data'],
          parameters: [
            { name: 'note', in: 'formData', type: 'string' },
            { name: 'file', in: 'formData', type: 'file', required: true },
          ],
          responses: { 200: { description: 'Uploaded' } },
        },
      },
    },
  },
  'https://uploads.example.test/swagger.json',
  'multipart',
)
const multipart = multipartApi.executables[0]!
assert.equal(
  multipart.binding.type === 'http' ? multipart.binding.bodyEncoding : undefined,
  'multipart',
)
assert.deepEqual(multipart.inputUiSchema.body, {
  file: { 'ui:widget': 'file' },
})
const multipartRequest = buildOperationRequest({
  specUrl: multipartApi.sourceUrl,
  serverUrl: multipartApi.targets[0]!,
  operation: multipart,
  formData: {
    body: {
      note: 'hello',
      file: 'data:text/plain;name=hello.txt;base64,aGk=',
    },
  },
  auth: {},
  authSchemes: [],
})
assert.equal(multipartRequest.headers?.['content-type'], undefined)
assert.deepEqual(multipartRequest.body, {
  kind: 'multipart',
  parts: [
    { kind: 'text', name: 'note', value: 'hello' },
    {
      kind: 'file',
      name: 'file',
      data: 'aGk=',
      filename: 'hello.txt',
      mediaType: 'text/plain',
    },
  ],
})

const authHeaders = new Headers()
applyAuth(
  authHeaders,
  new URL('https://example.test'),
  [{ name: 'oauth', type: 'oauth2' }],
  { oauth: 'token' },
)
assert.equal(authHeaders.get('authorization'), 'Bearer token')

console.log('openapi output schema ok')
