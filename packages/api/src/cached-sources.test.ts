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
  const body = (await response.json()) as { user: { id: string } }
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  return { cookie, userId: body.user.id }
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
  body: JSON.stringify({ metadata }),
})
assert.equal(anonymousPut.status, 401)

const firstUser = await signUp(`first-${Date.now()}@hookfish.test`)
const put = await api.request('/cached-sources/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    metadata: {
      ...metadata,
      credentials: { bearer: 'must-not-be-cached' },
      credentialsStored: true,
      sourceUrl: 'https://example.test?token=must-not-be-cached',
    },
  }),
})
assert.equal(put.status, 200, await put.clone().text())
const putBody = (await put.json()) as {
  cached: boolean
  cachedSource: {
    sourceId: string
    createdByUserId: string
    metadata: typeof metadata
    createdAt: string
    updatedAt: string
  }
}
assert.equal(putBody.cached, true)
assert.equal(putBody.cachedSource.sourceId, 'source-1')
assert.equal(putBody.cachedSource.createdByUserId, firstUser.userId)
assert.deepEqual(putBody.cachedSource.metadata, metadata)
assert.ok(Date.parse(putBody.cachedSource.createdAt))
assert.ok(Date.parse(putBody.cachedSource.updatedAt))
assert.equal(JSON.stringify(putBody).includes('must-not-be-cached'), false)

const get = await api.request('/cached-sources/source-1', {
  headers: { cookie: firstUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(get.status, 200)
assert.deepEqual(await get.json(), putBody)

const updated = await api.request('/cached-sources/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    metadata: { ...metadata, title: 'Updated Widget API' },
  }),
})
assert.equal(updated.status, 200)
const updatedBody = (await updated.json()) as typeof putBody
assert.equal(updatedBody.cachedSource.createdAt, putBody.cachedSource.createdAt)
assert.ok(updatedBody.cachedSource.updatedAt >= putBody.cachedSource.updatedAt)

const mcpPut = await api.request('/cached-sources/source-2', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    metadata: {
      ...metadata,
      kind: 'mcp',
      title: 'Widget MCP',
    },
  }),
})
assert.equal(mcpPut.status, 200)

const openApiList = await api.request('/cached-sources?kind=openapi', {
  headers: { cookie: firstUser.cookie, origin: 'http://hookfish.test' },
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

const secondUser = await signUp(`second-${Date.now()}@hookfish.test`)
const globalGet = await api.request('/cached-sources/source-1', {
  headers: { cookie: secondUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(globalGet.status, 200)
const globalBody = (await globalGet.json()) as typeof putBody
assert.equal(globalBody.cachedSource.createdByUserId, firstUser.userId)

const optedOut = await api.request('/cached-sources/source-3', {
  method: 'PUT',
  headers: {
    cookie: secondUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ cache: false, metadata }),
})
assert.equal(optedOut.status, 200)
assert.deepEqual(await optedOut.json(), {
  cached: false,
  cachedSource: null,
})
const optedOutGet = await api.request('/cached-sources/source-3', {
  headers: { cookie: firstUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(optedOutGet.status, 404)

console.log('cached source tests passed')
