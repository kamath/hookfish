import assert from 'node:assert/strict'
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
