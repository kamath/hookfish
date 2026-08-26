import assert from 'node:assert/strict'
import { toFetch } from './export-snippet.ts'

assert.equal(
  toFetch({
    method: 'GET',
    url: 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available',
    headers: {},
  }),
  'fetch("https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available")',
)

assert.equal(
  toFetch({
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
