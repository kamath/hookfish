import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApi } from './app'
import { createPgliteDb } from './db/pglite'

const dataDir = mkdtempSync(join(tmpdir(), 'hookfish-source-cache-'))
const api = createApi({ database: createPgliteDb(dataDir) })

async function signUp(email: string) {
  const response = await api.request('/auth/sign-up', {
    method: 'POST',
    headers: {
      origin: 'http://hookfish.test',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: email,
      email,
      password: 'password1',
    }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
}

const metadata = {
  kind: 'openapi',
  title: 'Widget API',
  version: '1.0.0',
  executables: [
    {
      id: 'getWidget',
      name: '/widgets/{id}',
      badge: 'GET',
      groups: ['Widgets'],
      binding: { type: 'http', method: 'get', path: '/widgets/{id}' },
      inputSchema: { type: 'object' },
      inputUiSchema: {},
    },
  ],
  groups: [{ name: 'Widgets' }],
  labels: { executable: 'Endpoint' },
}

const anonymousPut = await api.request('/cached-sources/source-1', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(metadata),
})
assert.equal(anonymousPut.status, 401)

const firstCookie = await signUp(`first-${Date.now()}@hookfish.test`)
const put = await api.request('/cached-sources/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstCookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify(metadata),
})
assert.equal(put.status, 200, await put.clone().text())
const putBody = (await put.json()) as {
  cachedSource: { sourceId: string; metadata: typeof metadata; cachedAt: string }
}
assert.equal(putBody.cachedSource.sourceId, 'source-1')
assert.deepEqual(putBody.cachedSource.metadata, metadata)
assert.ok(Date.parse(putBody.cachedSource.cachedAt))

const get = await api.request('/cached-sources/source-1', {
  headers: { cookie: firstCookie, origin: 'http://hookfish.test' },
})
assert.equal(get.status, 200)
assert.deepEqual(await get.json(), putBody)

const updated = await api.request('/cached-sources/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstCookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ ...metadata, title: 'Updated Widget API' }),
})
assert.equal(updated.status, 200)

const mcpPut = await api.request('/cached-sources/source-2', {
  method: 'PUT',
  headers: {
    cookie: firstCookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    ...metadata,
    kind: 'mcp',
    title: 'Widget MCP',
  }),
})
assert.equal(mcpPut.status, 200)

const openApiList = await api.request('/cached-sources?kind=openapi', {
  headers: { cookie: firstCookie, origin: 'http://hookfish.test' },
})
assert.equal(openApiList.status, 200)
const openApiListBody = (await openApiList.json()) as {
  cachedSources: Array<{ sourceId: string; metadata: { title: string } }>
}
assert.deepEqual(
  openApiListBody.cachedSources.map((source) => source.sourceId),
  ['source-1'],
)
assert.equal(openApiListBody.cachedSources[0]?.metadata.title, 'Updated Widget API')

const secondCookie = await signUp(`second-${Date.now()}@hookfish.test`)
const isolatedGet = await api.request('/cached-sources/source-1', {
  headers: { cookie: secondCookie, origin: 'http://hookfish.test' },
})
assert.equal(isolatedGet.status, 404)

console.log('cached source tests passed')
