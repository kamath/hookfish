import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hc } from 'hono/client'
import { createApi, type AppType } from './app'

const dataDir = mkdtempSync(join(tmpdir(), 'hookfish-auth-'))
process.env.PGLITE_DATA_DIR = dataDir
delete process.env.POSTGRES_URL

const api = createApi()
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

const signedIn = await client.auth['sign-in'].$post({
  json: { email, password: 'password1' },
})
assert.equal(signedIn.status, 200)
assert.equal((await signedIn.json()).user?.email, email)

const rejected = await client.auth['sign-in'].$post({
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
