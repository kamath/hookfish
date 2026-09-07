import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const { isAddressInUse, isListenTargetTaken, resolveListenPort } = await import(
  fileURLToPath(new URL('../dist/listen.js', import.meta.url))
)

function listen(server, port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })
}

function close(server) {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

test('resolveListenPort returns the start port when it is free', async () => {
  const allocator = createServer()
  await listen(allocator, 0)
  const address = allocator.address()
  assert.ok(address && typeof address === 'object')
  const port = address.port
  await close(allocator)

  assert.equal(await resolveListenPort('127.0.0.1', port), port)
})

test('resolveListenPort increments past occupied ports', async () => {
  const first = createServer()
  await listen(first, 0)
  const address = first.address()
  assert.ok(address && typeof address === 'object')
  const startPort = address.port

  const second = createServer()
  await listen(second, startPort + 1)

  const next = await resolveListenPort('127.0.0.1', startPort)
  assert.ok(next >= startPort + 2)

  const probe = createServer()
  await listen(probe, next)
  await close(first)
  await close(second)
  await close(probe)
})

test('isListenTargetTaken reports a bound loopback port', async () => {
  const blocker = createServer()
  await listen(blocker, 0)
  const address = blocker.address()
  assert.ok(address && typeof address === 'object')
  assert.equal(await isListenTargetTaken('127.0.0.1', address.port), true)
  await close(blocker)
  assert.equal(await isListenTargetTaken('127.0.0.1', address.port), false)
})

test('isAddressInUse recognizes EADDRINUSE', () => {
  assert.equal(isAddressInUse({ code: 'EADDRINUSE' }), true)
  assert.equal(isAddressInUse({ code: 'EACCES' }), false)
  assert.equal(isAddressInUse(new Error('nope')), false)
})
