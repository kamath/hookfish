import assert from 'node:assert/strict'
import { toFetch } from './export-snippet.ts'

assert.equal(
  toFetch({
    method: 'GET',
    url: 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available',
    headers: {},
  }),
  'await fetch("https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available")',
)

assert.equal(
  toFetch({
    method: 'GET',
    url: "https://example.com/it's",
    headers: { 'X-Name': "O'Reilly" },
  }),
  'await fetch("https://example.com/it\'s", {\n  headers: {\n    "X-Name": "O\'Reilly"\n  },\n})',
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
assert.match(fetchPost, /await fetch\("https:\/\/petstore3\.swagger\.io\/api\/v3\/pet", \{/)
assert.match(fetchPost, /method: "POST"/)
assert.match(fetchPost, /"Content-Type": "application\/json"/)
assert.match(fetchPost, /body: JSON\.stringify\(\{/)
assert.match(fetchPost, /"name": "doggie"/)

console.log('export-snippet ok')
