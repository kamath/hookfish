import assert from 'node:assert/strict'
import { toCurl } from './export-snippet.ts'

assert.equal(
  toCurl({
    method: 'GET',
    url: 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available',
    headers: {},
  }),
  "curl 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available'",
)

assert.equal(
  toCurl({
    method: 'GET',
    url: "https://example.com/it's",
    headers: { 'X-Name': "O'Reilly" },
  }),
  "curl 'https://example.com/it'\\''s' \\\n  -H 'X-Name: O'\\''Reilly'",
)

const curlPost = toCurl({
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
assert.match(curlPost, /curl 'https:\/\/petstore3\.swagger\.io\/api\/v3\/pet' \\/)
assert.match(curlPost, /-X POST \\/)
assert.match(curlPost, /-H 'Content-Type: application\/json' \\/)
assert.match(curlPost, /--data-raw '\{/)
assert.match(curlPost, /"name": "doggie"/)

console.log('export-snippet ok')
