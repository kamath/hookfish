import assert from 'node:assert/strict'
import { authPlaceholder, toFetch, withAuthPlaceholders } from './export-snippet.ts'

assert.equal(authPlaceholder('api_key'), 'INSERT_API_KEY')
assert.equal(authPlaceholder('bearerAuth'), 'INSERT_BEARER_AUTH')
assert.equal(authPlaceholder('x-api-key'), 'INSERT_X_API_KEY')
assert.equal(authPlaceholder('basic.username'), 'INSERT_BASIC_USERNAME')
assert.equal(authPlaceholder('APIKey'), 'INSERT_API_KEY')

assert.deepEqual(
  withAuthPlaceholders({ api_key: 'secret' }, ['api_key', 'token']),
  { api_key: 'secret', token: 'INSERT_TOKEN' },
)
assert.deepEqual(withAuthPlaceholders({}, ['api_key']), {
  api_key: 'INSERT_API_KEY',
})
assert.deepEqual(withAuthPlaceholders({ api_key: '  ' }, ['api_key']), {
  api_key: 'INSERT_API_KEY',
})

assert.equal(
  toFetch({
    transport: 'http',
    method: 'GET',
    url: 'https://example.com/pets',
    headers: { api_key: 'INSERT_API_KEY' },
  }),
  `fetch("https://example.com/pets", {
  headers: {
    api_key: "INSERT_API_KEY",
  },
})`,
)

assert.equal(
  toFetch({
    transport: 'http',
    method: 'GET',
    url: 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available',
    headers: {},
  }),
  'fetch("https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available")',
)

assert.equal(
  toFetch({
    transport: 'http',
    method: 'GET',
    url: 'https://example.com/pets',
    headers: { Accept: 'application/json' },
  }),
  `fetch("https://example.com/pets", {
  headers: {
    Accept: "application/json",
  },
})`,
)

const fetchPost = toFetch({
  transport: 'http',
  method: 'POST',
  url: 'https://petstore3.swagger.io/api/v3/pet',
  headers: {
    'Content-Type': 'application/json',
    api_key: 'special-key',
  },
  body: JSON.stringify({
    name: 'doggie',
    photoUrls: ['https://example.com/a'],
    status: 'available',
  }),
})
assert.equal(
  fetchPost,
  `fetch("https://petstore3.swagger.io/api/v3/pet", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    api_key: "special-key",
  },
  body: JSON.stringify({
    "name": "doggie",
    "photoUrls": [
      "https://example.com/a"
    ],
    "status": "available"
  }),
})`,
)

console.log('export-snippet ok')
