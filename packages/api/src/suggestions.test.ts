import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPgliteDb } from './db/pglite'

const dataDir = await mkdtemp(join(tmpdir(), 'hookfish-suggestions-'))

try {
  const database = await createPgliteDb(dataDir)
  const rows = await database.listRegistryFeedRows([
    'trending_mcp',
    'trending_api',
  ])

  assert.equal(rows.length, 10)
  assert.deepEqual(
    [...new Set(rows.map((row) => row.tag))],
    ['trending_api', 'trending_mcp'],
  )
  assert.deepEqual(Object.keys(rows[0] ?? {}).sort(), [
    'tag',
    'title',
    'type',
    'url',
  ])
  assert.deepEqual([...new Set(rows.map((row) => row.type))].sort(), [
    'API',
    'MCP',
  ])
  assert.deepEqual(await database.listRegistryFeedRows(['not_in_feed']), [])
} finally {
  await rm(dataDir, { force: true, recursive: true })
}

console.log('registry and tags migration data ok')
