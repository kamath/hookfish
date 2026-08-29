import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
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

test('recovers a partial PGlite migration on first page load', { timeout: 20_000 }, async (t) => {
  const assets = fileURLToPath(new URL('../web/server/assets/', import.meta.url))
  assert.equal(
    existsSync(new URL('../web/server/assets/drizzle/meta/_journal.json', import.meta.url)),
    true,
    `missing drizzle journal under ${assets}`,
  )
  assert.equal(
    existsSync(fileURLToPath(import.meta.resolve('@electric-sql/pglite'))),
    true,
    'missing PGlite runtime dependency',
  )

  const portServer = createServer()
  await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve))
  const address = portServer.address()
  assert.ok(address && typeof address === 'object')
  await new Promise((resolve, reject) => {
    portServer.close((error) => (error ? reject(error) : resolve()))
  })

  const dataDir = mkdtempSync(join(tmpdir(), 'hookfish-cli-test-'))
  const migration = readFileSync(
    new URL('../../api/drizzle/0000_lovely_brood.sql', import.meta.url),
    'utf8',
  )
  const partialDb = new PGlite(dataDir)
  await partialDb.exec(migration.split('--> statement-breakpoint')[0])
  await partialDb.close()

  const child = spawn(process.execPath, [cliEntry, '--port', String(address.port)], {
    env: { ...process.env, PGLITE_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
    rmSync(dataDir, { force: true, recursive: true })
  })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`CLI did not start:\n${output}`)),
      10_000,
    )
    child.stdout.on('data', (chunk) => {
      if (chunk.includes('listening on')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`CLI exited with ${code}:\n${output}`))
    })
  })

  const page = await fetch(`http://127.0.0.1:${address.port}/`)
  assert.equal(page.status, 200)
  const session = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/session`,
  )
  assert.equal(session.status, 200, output)
  assert.deepEqual(await session.json(), { user: null })
})
