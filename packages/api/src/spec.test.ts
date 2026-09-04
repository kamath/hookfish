import assert from 'node:assert/strict'
import { assertHttpRequestMatchesSpec, isOpenApiDocument } from './spec'

const specUrl = 'https://api.test/openapi.json'

const spec = {
  openapi: '3.1.0',
  info: { title: 'Widgets' },
  servers: [{ url: 'https://api.test/v1' }],
  paths: {
    '/widgets': {
      post: { responses: { '201': { description: 'Created' } } },
      get: { responses: { '200': { description: 'List' } } },
    },
    '/widgets/{id}': {
      get: { responses: { '200': { description: 'One' } } },
    },
    '/files/{name}.json': {
      get: { responses: { '200': { description: 'File' } } },
    },
  },
}

assert.equal(isOpenApiDocument(spec), true)
assert.equal(isOpenApiDocument({ jsonrpc: '2.0' }), false)

assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(spec, specUrl, {
    method: 'POST',
    url: 'https://api.test/v1/widgets',
  }),
)
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(spec, specUrl, {
    method: 'get',
    url: 'https://api.test/v1/widgets/abc?pretty=1',
  }),
)
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(spec, specUrl, {
    method: 'GET',
    url: 'https://api.test/v1/files/report.json',
  }),
)

assert.throws(
  () =>
    assertHttpRequestMatchesSpec(spec, specUrl, {
      method: 'DELETE',
      url: 'https://api.test/v1/widgets',
    }),
  /does not match an operation/,
)
assert.throws(
  () =>
    assertHttpRequestMatchesSpec(spec, specUrl, {
      method: 'POST',
      url: 'https://evil.test/v1/widgets',
    }),
  /does not match an operation/,
)
assert.throws(
  () =>
    assertHttpRequestMatchesSpec({ title: 'Nope' }, specUrl, {
      method: 'GET',
      url: 'https://api.test/v1/widgets',
    }),
  /OpenAPI or Swagger document/,
)

const swagger = {
  swagger: '2.0',
  host: 'petstore.test',
  basePath: '/v2',
  schemes: ['https'],
  paths: {
    '/pet/{petId}': {
      get: { responses: { '200': { description: 'Pet' } } },
    },
  },
}
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(swagger, 'https://petstore.test/swagger.json', {
    method: 'GET',
    url: 'https://petstore.test/v2/pet/12',
  }),
)

const relative = {
  openapi: '3.1.0',
  info: { title: 'Self' },
  servers: [{ url: '/' }],
  paths: {
    '/openapi.json': {
      get: { responses: { '200': { description: 'Doc' } } },
    },
  },
}
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(
    relative,
    '/openapi.json',
    { method: 'GET', url: 'http://localhost/openapi.json' },
    'http://localhost/execute',
  ),
)

const envSpec = {
  openapi: '3.1.0',
  info: { title: 'Env' },
  servers: [{ url: 'https://{env}.example.com/v1' }],
  paths: {
    '/status': {
      get: { responses: { '200': { description: 'OK' } } },
    },
  },
}
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(envSpec, 'https://docs.example.com/openapi.json', {
    method: 'GET',
    url: 'https://prod.example.com/v1/status',
  }),
)

const refSpec = {
  openapi: '3.1.0',
  info: { title: 'Refs' },
  servers: [{ url: 'https://ref.test' }],
  paths: {
    '/ping': { $ref: '#/components/pathItems/Ping' },
  },
  components: {
    pathItems: {
      Ping: {
        get: { responses: { '200': { description: 'Pong' } } },
      },
    },
  },
}
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(refSpec, 'https://ref.test/openapi.json', {
    method: 'GET',
    url: 'https://ref.test/ping',
  }),
)

const originFallback = {
  openapi: '3.1.0',
  info: { title: 'Origin' },
  paths: {
    '/health': {
      get: { responses: { '200': { description: 'OK' } } },
    },
  },
}
assert.doesNotThrow(() =>
  assertHttpRequestMatchesSpec(
    originFallback,
    'https://origin.test/docs/openapi.json',
    { method: 'GET', url: 'https://origin.test/health' },
  ),
)

console.log('spec matching tests passed')
