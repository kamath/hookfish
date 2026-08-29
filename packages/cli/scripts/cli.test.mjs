import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url))

test('prints CLI help', () => {
  const result = spawnSync(process.execPath, [cliEntry, '--help'], {
    encoding: 'utf8',
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Usage: hookfish \[options\]/)
  assert.match(result.stdout, /--port <number>/)
  assert.match(result.stdout, /--host <host>/)
})

test('rejects invalid ports', () => {
  const result = spawnSync(process.execPath, [cliEntry, '--port', '70000'], {
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /integer between 1 and 65535/)
})

test('refuses to start when the port is already taken', async () => {
  const blocker = createServer()
  await new Promise((resolve) => {
    blocker.listen(0, '127.0.0.1', resolve)
  })
  const address = blocker.address()
  assert.ok(address && typeof address === 'object')

  const result = spawnSync(process.execPath, [cliEntry, '--port', String(address.port)], {
    encoding: 'utf8',
    timeout: 15_000,
  })
  blocker.close()

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /already in use/)
})

test('bundles pglite assets and drizzle migrations', () => {
  const assets = fileURLToPath(new URL('../web/server/assets/', import.meta.url))
  assert.equal(existsSync(new URL('../web/server/assets/pglite.data', import.meta.url)), true)
  assert.equal(existsSync(new URL('../web/server/assets/pglite.wasm', import.meta.url)), true)
  assert.equal(existsSync(new URL('../web/server/assets/initdb.wasm', import.meta.url)), true)
  assert.equal(
    existsSync(new URL('../web/server/assets/drizzle/meta/_journal.json', import.meta.url)),
    true,
    `missing drizzle journal under ${assets}`,
  )
})
