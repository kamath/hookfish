import assert from 'node:assert/strict'
import { renderSnippet } from './export-snippet.ts'

const get = {
  method: 'GET',
  url: 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available',
  headers: {},
}

assert.equal(
  renderSnippet('curl', get),
  "curl 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available'",
)

assert.equal(
  renderSnippet('fetch', get),
  'await fetch("https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available")',
)

assert.equal(
  renderSnippet('requests', get),
  'import requests\n\nresponse = requests.get("https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available")',
)

const quoted = {
  method: 'GET',
  url: "https://example.com/it's",
  headers: { "X-Name": "O'Reilly" },
}

assert.equal(
  renderSnippet('curl', quoted),
  "curl 'https://example.com/it'\\''s' \\\n  -H 'X-Name: O'\\''Reilly'",
)

const post = {
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
}

const curlPost = renderSnippet('curl', post)
assert.match(curlPost, /curl 'https:\/\/petstore3\.swagger\.io\/api\/v3\/pet' \\/)
assert.match(curlPost, /-X POST \\/)
assert.match(curlPost, /-H 'Content-Type: application\/json' \\/)
assert.match(curlPost, /--data-raw '\{/)
assert.match(curlPost, /"name": "doggie"/)

const fetchPost = renderSnippet('fetch', post)
assert.match(fetchPost, /await fetch\("https:\/\/petstore3\.swagger\.io\/api\/v3\/pet", \{/)
assert.match(fetchPost, /method: "POST"/)
assert.match(fetchPost, /body: JSON\.stringify\(\{/)

const requestsPost = renderSnippet('requests', post)
assert.match(requestsPost, /import requests/)
assert.match(requestsPost, /requests\.post\(/)
assert.match(requestsPost, /json=\{/)
assert.match(requestsPost, /"name": "doggie"/)

const axiosPost = renderSnippet('axios', post)
assert.match(axiosPost, /import axios from 'axios'/)
assert.match(axiosPost, /method: "post"/)
assert.match(axiosPost, /data: \{/)

const httpxPost = renderSnippet('httpx', post)
assert.match(httpxPost, /import httpx/)
assert.match(httpxPost, /httpx\.post\(/)

const httpiePost = renderSnippet('httpie', post)
assert.match(httpiePost, /http POST 'https:\/\/petstore3\.swagger\.io\/api\/v3\/pet' \\/)
assert.match(httpiePost, /--raw '\{/)

const form = {
  method: 'POST',
  url: 'https://example.com/form',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'name=doggie&active=true',
}

assert.match(renderSnippet('requests', form), /data=\{/)
assert.match(renderSnippet('requests', form), /"name": "doggie"/)

const flags = {
  method: 'PUT',
  url: 'https://example.com/item',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: true, missing: null, count: 0 }),
}
assert.match(renderSnippet('requests', flags), /True/)
assert.match(renderSnippet('requests', flags), /None/)

console.log('export-snippet ok')
