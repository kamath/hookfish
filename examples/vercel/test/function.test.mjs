// Exercises the Vercel function body against a real Node server so the (req, res) →
// Request → Response bridge is verified without deploying.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'

const { default: listener } = await import('../api/index.mjs')

const server = createServer(listener)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`

test('serves the SSR document shell', async () => {
  const response = await fetch(`${base}/`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.match(await response.text(), /<html/)
})

test('serves the mounted API', async () => {
  const response = await fetch(`${base}/api/openapi.json`)
  assert.equal(response.status, 200)
  const document = await response.json()
  assert.equal(typeof document.openapi, 'string')
})

test.after(() => server.close())
