import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPgliteDb } from './pglite'

const root = await mkdtemp(join(tmpdir(), 'hookfish-pglite-'))
const dataDir = join(root, 'missing-parent', 'pglite')

assert.equal(existsSync(join(root, 'missing-parent')), false)

const database = await createPgliteDb(dataDir)
assert.equal(existsSync(dataDir), true)
const rows = await database.listRegistryFeedRows(['trending_mcp'])
assert.ok(Array.isArray(rows))

await rm(root, { recursive: true, force: true })
console.log('pglite creates missing nested data directories')
