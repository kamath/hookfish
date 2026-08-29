import assert from 'node:assert/strict'
import { createApiAuthClient } from './auth-client'

const client = createApiAuthClient('http://hookfish.test/api/auth')
assert.equal(typeof client.signIn.email, 'function')
assert.equal(typeof client.signUp.email, 'function')
assert.equal(typeof client.signOut, 'function')
assert.equal(typeof client.getSession, 'function')
assert.equal(typeof client.token, 'function')

console.log('auth client tests passed')
