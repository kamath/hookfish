import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const commandName = Object.keys(packageJson.bin ?? {})[0]

function cliEnv(extra = {}) {
  return {
    ...process.env,
    HOOKFISH_SKIP_UPDATE_CHECK: '1',
    ...extra,
  }
}

function assertHelpText(stdout) {
  assert.match(stdout, new RegExp(`Usage: ${commandName} \\[options\\] \\[command\\]`))
  assert.match(stdout, /Commands:/)
  assert.match(stdout, /up \[options\]\s+Start the local server/)
  assert.match(stdout, /update \[options\]\s+Install the latest version from npm/)
}

test('prints CLI help with no arguments', () => {
  const result = spawnSync(process.execPath, [cliEntry], {
    encoding: 'utf8',
    env: cliEnv(),
  })

  assert.equal(result.status, 0)
  assertHelpText(result.stdout)
})

test('prints CLI help for --help', () => {
  const result = spawnSync(process.execPath, [cliEntry, '--help'], {
    encoding: 'utf8',
    env: cliEnv(),
  })

  assert.equal(result.status, 0)
  assertHelpText(result.stdout)
})

test('prints up help', () => {
  const result = spawnSync(process.execPath, [cliEntry, 'up', '--help'], {
    encoding: 'utf8',
    env: cliEnv(),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, new RegExp(`Usage: ${commandName} up \\[options\\]`))
  assert.match(result.stdout, /--port <number>/)
  assert.match(result.stdout, /--host <host>/)
})

test('rejects invalid ports', () => {
  const result = spawnSync(process.execPath, [cliEntry, 'up', '--port', '70000'], {
    encoding: 'utf8',
    env: cliEnv(),
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

  const result = spawnSync(process.execPath, [cliEntry, 'up', '--port', String(address.port)], {
    encoding: 'utf8',
    env: cliEnv(),
    timeout: 15_000,
  })
  blocker.close()

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /already in use/)
})
