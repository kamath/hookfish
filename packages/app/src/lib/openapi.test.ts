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

const grouped = specToClient(
  {
    openapi: '3.1.0',
    info: { title: 'Smithery API', version: '1' },
    tags: [
      {
        name: 'OpenAPI',
        description: 'Load OpenAPI documents and execute HTTP operations.',
      },
      { name: 'MCP', description: 'Streamable HTTP MCP proxy.' },
    ],
    paths: {
      '/spec': {
        post: {
          tags: ['OpenAPI'],
          summary: 'Fetch and parse an OpenAPI document',
          responses: { 200: { description: 'ok' } },
        },
      },
      '/execute': {
        post: {
          tags: ['OpenAPI'],
          summary: 'Execute an HTTP request',
          responses: { 200: { description: 'ok' } },
        },
      },
      '/mcp-proxy': {
        post: {
          tags: ['MCP'],
          summary: 'Proxy a Streamable HTTP MCP request',
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  },
  'https://example.test/openapi.json',
  'self',
)
assert.deepEqual(grouped.groups, [
  {
    name: 'OpenAPI',
    description: 'Load OpenAPI documents and execute HTTP operations.',
  },
  { name: 'MCP', description: 'Streamable HTTP MCP proxy.' },
])
assert.deepEqual(
  grouped.executables.map((executable) => [executable.name, executable.groups]),
  [
    ['/spec', ['OpenAPI']],
    ['/execute', ['OpenAPI']],
    ['/mcp-proxy', ['MCP']],
  ],
)

console.log('openapi output schema ok')
