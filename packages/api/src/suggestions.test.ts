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

  await database.upsertRegistryEntry({
    url: 'https://petstore3.swagger.io/api/v3/openapi.json',
    title: 'Updated Petstore',
    type: 'API',
  })
  const updated = await database.listRegistryFeedRows(['trending_api'])
  assert.equal(
    updated.find((row) => row.url === 'https://petstore3.swagger.io/api/v3/openapi.json')
      ?.title,
    'Updated Petstore',
  )

  await database.upsertRegistryEntry({
    url: 'https://new.example.test/openapi.json',
    title: 'New API',
    type: 'API',
  })
  await database.upsertRegistryEntry({
    url: 'https://new.example.test/openapi.json',
    title: 'New API v2',
    type: 'API',
  })
  assert.equal(
    (await database.listRegistryFeedRows(['trending_api'])).some(
      (row) => row.url === 'https://new.example.test/openapi.json',
    ),
    false,
  )
  assert.deepEqual(await database.getRegistryEntry('https://new.example.test/openapi.json'), {
    url: 'https://new.example.test/openapi.json',
    title: 'New API v2',
    type: 'API',
  })
  assert.equal(await database.getRegistryEntry('https://missing.example.test'), undefined)
} finally {
  await rm(dataDir, { force: true, recursive: true })
}

console.log('registry and tags migration data ok')
