import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hc } from 'hono/client'
import { createApi, type AppType } from './app'
import { createPgliteDb } from './db/pglite'

const dataDir = mkdtempSync(join(tmpdir(), 'hookfish-auth-'))

const api = createApi({ database: createPgliteDb(dataDir) })
const client = hc<AppType>('http://hookfish.test', {
  fetch: ((input, init) => {
    const headers = new Headers(init?.headers)
    if (!headers.has('origin')) {
      headers.set('origin', 'http://hookfish.test')
    }
    return api.request(input, { ...init, headers })
  }) as typeof fetch,
})

const loggedOut = await client.auth.session.$get()
assert.equal(loggedOut.status, 200)
assert.deepEqual(await loggedOut.json(), { user: null })

const email = `ada-${Date.now()}@hookfish.test`
const signedUp = await client.auth['sign-up'].$post({
  json: { name: 'Ada Lovelace', email, password: 'password1' },
})
assert.equal(signedUp.status, 200, await signedUp.clone().text())
const signedUpBody = await signedUp.json()
assert.equal(signedUpBody.user?.email, email)
assert.equal(signedUpBody.user?.name, 'Ada Lovelace')

const cookie = signedUp.headers
  .getSetCookie()
  .map((value) => value.split(';')[0])
  .join('; ')
assert.ok(cookie)

const session = await api.request('/auth/session', {
  headers: { cookie, origin: 'http://hookfish.test' },
})
assert.equal(session.status, 200)
assert.equal((await session.json()).user?.email, email)

const createdKeyResponse = await api.request('/auth/api-keys', {
  method: 'POST',
  headers: {
    cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ name: 'Automation', expiration: '7 days' }),
})
assert.equal(createdKeyResponse.status, 201, await createdKeyResponse.clone().text())
const createdKeyBody = (await createdKeyResponse.json()) as {
  apiKey: { name: string; expiresAt: string | null; key: string }
}
assert.equal(createdKeyBody.apiKey.name, 'Automation')
assert.ok(createdKeyBody.apiKey.expiresAt)
assert.match(createdKeyBody.apiKey.key, /^hf_[A-Za-z0-9_-]{43}$/)

const neverKeyResponse = await api.request('/auth/api-keys', {
  method: 'POST',
  headers: {
    cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ name: 'Permanent', expiration: 'never' }),
})
assert.equal(neverKeyResponse.status, 201, await neverKeyResponse.clone().text())
assert.equal(((await neverKeyResponse.json()) as { apiKey: { expiresAt: string | null } }).apiKey.expiresAt, null)

const listedWithSession = await api.request('/auth/api-keys', {
  headers: { cookie, origin: 'http://hookfish.test' },
})
assert.equal(listedWithSession.status, 200)
const listedBody = (await listedWithSession.json()) as {
  apiKeys: Array<{ name: string; expiresAt: string | null }>
}
assert.deepEqual(
  listedBody.apiKeys.map((key) => key.name),
  ['Permanent', 'Automation'],
)
assert.equal(JSON.stringify(listedBody).includes(createdKeyBody.apiKey.key), false)
assert.equal(listedBody.apiKeys.some((key) => 'key' in key), false)

const listedWithApiKey = await api.request('/auth/api-keys', {
  headers: { 'x-api-key': createdKeyBody.apiKey.key },
})
assert.equal(listedWithApiKey.status, 200)
assert.deepEqual(await listedWithApiKey.json(), listedBody)

const tokenResponse = await api.request('/auth/token', {
  headers: { cookie, origin: 'http://hookfish.test' },
})
assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text())
const jwt = ((await tokenResponse.json()) as { token: string }).token
assert.equal(jwt.split('.').length, 3)

const listedWithJwt = await api.request('/auth/api-keys', {
  headers: { authorization: `Bearer ${jwt}` },
})
assert.equal(listedWithJwt.status, 200)
assert.deepEqual(await listedWithJwt.json(), listedBody)

const createdThroughViewer = await api.request('/execute', {
  method: 'POST',
  headers: {
    cookie,
    origin: 'http://hookfish.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    transport: 'http',
    method: 'post',
    url: 'http://localhost/auth/api-keys',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'OpenAPI viewer', expiration: '1 day' }),
  }),
})
assert.equal(createdThroughViewer.status, 200)
const viewerResult = await createdThroughViewer.json()
assert.equal(viewerResult.status.code, 201)
assert.equal(JSON.parse(viewerResult.body).apiKey.name, 'OpenAPI viewer')

const invalidApiKey = await api.request('/auth/api-keys', {
  headers: { 'x-api-key': 'hf_invalid' },
})
assert.equal(invalidApiKey.status, 401)

const signedIn = await client.auth.login.$post({
  json: { email, password: 'password1' },
})
assert.equal(signedIn.status, 200)
assert.equal((await signedIn.json()).user?.email, email)

const rejected = await client.auth.login.$post({
  json: { email, password: 'wrong-password' },
})
assert.equal(rejected.status, 400)

const signedOut = await api.request('/auth/sign-out', {
  method: 'POST',
  headers: { cookie, origin: 'http://hookfish.test' },
})
assert.equal(signedOut.status, 200)

const afterSignOut = await api.request('/auth/session', {
  headers: { cookie, origin: 'http://hookfish.test' },
})
assert.equal(afterSignOut.status, 200)
assert.deepEqual(await afterSignOut.json(), { user: null })

console.log('auth rpc tests passed')
