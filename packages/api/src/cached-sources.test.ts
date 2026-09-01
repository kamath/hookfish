import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApi } from './app'
import {
  SOURCE_REFRESH_COOLDOWN_MESSAGE,
  SOURCE_REFRESH_MIN_INTERVAL_MS,
  assertCanForceRefresh,
  putCachedSource,
  sourceRefreshWaitMs,
} from './cached-sources'
import { createPgliteDb } from './db/pglite'

const now = Date.parse('2026-03-01T15:45:30.000Z')
assert.equal(SOURCE_REFRESH_MIN_INTERVAL_MS, 60_000)
assert.equal(sourceRefreshWaitMs('2026-03-01T15:45:00.000Z', now), 30_000)
assert.throws(
  () => assertCanForceRefresh('2026-03-01T15:45:00.000Z', now),
  (error) =>
    error instanceof Error && error.message === SOURCE_REFRESH_COOLDOWN_MESSAGE,
)
assert.doesNotThrow(() => assertCanForceRefresh('2026-03-01T15:44:00.000Z', now))

const dataDir = mkdtempSync(join(tmpdir(), 'hookfish-source-cache-'))
const database = createPgliteDb(dataDir)
const api = createApi({ database })

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
  kind: 'openapi' as const,
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
const sourceUrl = 'https://api.example.com/openapi.json'

const anonymousPut = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sourceUrl, metadata }),
})
assert.equal(anonymousPut.status, 401)

const firstUser = await signUp(`first-${Date.now()}@hookfish.test`)
const put = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl,
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
  entry: {
    sourceId: string
    sourceUrl: string
    createdByUserId: string
    kind: string
    title: string
    version?: string
    executableCount: number
    createdAt: string
    updatedAt: string
  }
}
assert.equal(putBody.cached, true)
assert.equal(putBody.entry.sourceId, 'source-1')
assert.equal(putBody.entry.sourceUrl, sourceUrl)
assert.equal(putBody.entry.createdByUserId, firstUser.userId)
assert.equal(putBody.entry.kind, 'openapi')
assert.equal(putBody.entry.title, 'Widget API')
assert.equal(putBody.entry.executableCount, 1)
assert.ok(Date.parse(putBody.entry.createdAt))
assert.ok(Date.parse(putBody.entry.updatedAt))
assert.equal(JSON.stringify(putBody).includes('must-not-be-cached'), false)

const get = await api.request('/registry/source-1', {
  headers: { cookie: firstUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(get.status, 200)
const getBody = (await get.json()) as {
  entry: {
    sourceId: string
    sourceUrl: string
    createdByUserId: string
    metadata: typeof metadata
    createdAt: string
    updatedAt: string
  }
}
assert.deepEqual(getBody.entry.metadata, metadata)
assert.equal(getBody.entry.createdAt, putBody.entry.createdAt)

const updated = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl,
    metadata: { ...metadata, title: 'Updated Widget API' },
  }),
})
assert.equal(updated.status, 200)
const updatedBody = (await updated.json()) as typeof putBody
assert.equal(updatedBody.entry.title, 'Widget API')
assert.equal(updatedBody.entry.createdAt, putBody.entry.createdAt)
assert.equal(updatedBody.entry.updatedAt, putBody.entry.updatedAt)

const forceTooSoon = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    force: true,
    sourceUrl,
    metadata: { ...metadata, title: 'Forced Widget API' },
  }),
})
assert.equal(forceTooSoon.status, 429)
assert.deepEqual(await forceTooSoon.json(), {
  error: 'Wait a minute before refreshing again.',
})

const quietUpdate = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl,
    metadata: { ...metadata, title: 'Quiet Widget API' },
  }),
})
assert.equal(quietUpdate.status, 200)
assert.equal(
  ((await quietUpdate.json()) as typeof putBody).entry.title,
  'Widget API',
)

const forced = await putCachedSource(database, {
  userId: firstUser.userId,
  sourceId: 'source-1',
  sourceUrl,
  metadata: { ...metadata, title: 'Forced Widget API' },
  force: true,
  now: new Date(Date.parse(putBody.entry.updatedAt) + SOURCE_REFRESH_MIN_INTERVAL_MS),
})
assert.equal(forced.metadata.title, 'Forced Widget API')
assert.ok(forced.updatedAt > putBody.entry.updatedAt)

const mcpPut = await api.request('/registry/source-2', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl: 'https://mcp.example.com/rpc',
    metadata: {
      ...metadata,
      kind: 'mcp',
      title: 'Widget MCP',
    },
  }),
})
assert.equal(mcpPut.status, 200)

const openApiList = await api.request('/registry?kind=openapi', {
  headers: { cookie: firstUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(openApiList.status, 200)
const openApiListBody = (await openApiList.json()) as {
  entries: Array<{
    sourceId: string
    title: string
    executableCount: number
  }>
}
assert.deepEqual(
  openApiListBody.entries.map((source) => source.sourceId),
  ['source-1'],
)
assert.equal(openApiListBody.entries[0]?.title, 'Forced Widget API')
assert.equal(openApiListBody.entries[0]?.executableCount, 1)
assert.equal('metadata' in (openApiListBody.entries[0] ?? {}), false)

const secondUser = await signUp(`second-${Date.now()}@hookfish.test`)
const globalGet = await api.request('/registry/source-1', {
  headers: { cookie: secondUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(globalGet.status, 200)
const globalBody = (await globalGet.json()) as typeof getBody
assert.equal(globalBody.entry.createdByUserId, firstUser.userId)

const mismatchedUrl = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl: 'https://other.example.com/openapi.json',
    metadata,
  }),
})
assert.equal(mismatchedUrl.status, 409)

const forbiddenUpdate = await api.request('/registry/source-1', {
  method: 'PUT',
  headers: {
    cookie: secondUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl,
    metadata: { ...metadata, title: 'Spoofed title' },
  }),
})
assert.equal(forbiddenUpdate.status, 403)

const duplicateUrl = await api.request('/registry/other-source-id', {
  method: 'PUT',
  headers: {
    cookie: secondUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl,
    metadata: { ...metadata, title: 'Spoofed title' },
  }),
})
assert.equal(duplicateUrl.status, 200)
const duplicateBody = (await duplicateUrl.json()) as typeof putBody
assert.equal(duplicateBody.entry.sourceId, 'source-1')
assert.equal(duplicateBody.entry.title, 'Forced Widget API')

const optedOut = await api.request('/registry/source-3', {
  method: 'PUT',
  headers: {
    cookie: secondUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ cache: false, sourceUrl, metadata }),
})
assert.equal(optedOut.status, 200)
assert.deepEqual(await optedOut.json(), {
  cached: false,
  entry: null,
  reason: 'cache-disabled',
})
const optedOutGet = await api.request('/registry/source-3', {
  headers: { cookie: firstUser.cookie, origin: 'http://hookfish.test' },
})
assert.equal(optedOutGet.status, 404)

const localSubmission = await api.request('/registry/source-4', {
  method: 'PUT',
  headers: {
    cookie: firstUser.cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sourceUrl: 'https://localhost:8787/mcp',
    metadata,
  }),
})
assert.equal(localSubmission.status, 200)
assert.deepEqual(await localSubmission.json(), {
  cached: false,
  entry: null,
  reason: 'non-public-url',
})

console.log('cached source tests passed')
