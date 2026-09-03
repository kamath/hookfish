import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPgliteDb } from './db/pglite'

const dataDir = await mkdtemp(join(tmpdir(), 'hookfish-suggestions-'))

try {
  const database = await createPgliteDb(dataDir)
  const suggestions = await database.listSuggestedSources()

  assert.equal(suggestions.length, 10)
  assert.deepEqual(
    [...new Set(suggestions.map((suggestion) => suggestion.category_name))],
    ['MCP Servers', 'OpenAPI'],
  )
  assert.deepEqual(Object.keys(suggestions[0] ?? {}).sort(), [
    'category_name',
    'title',
    'type',
    'url',
  ])
  assert.deepEqual([...new Set(suggestions.map((suggestion) => suggestion.type))].sort(), [
    'API',
    'MCP',
  ])
} finally {
  await rm(dataDir, { force: true, recursive: true })
}

console.log('suggestions migration and seed data ok')
