import assert from 'node:assert/strict'
import type { CatalogEntry } from './catalog'
import {
  SEARCH_ROW_ID,
  isSourceUrl,
  parseSourceUrl,
  registryEntries,
  registrySearchRow,
  searchRegistry,
} from './registry-search'

function entry(
  id: string,
  kind: 'mcp' | 'openapi',
  title: string,
  detail = `${id}.example`,
): CatalogEntry {
  return { id, kind, title, detail, url: `https://${detail}` }
}

const arcadeOmni = entry('arcade-omni', 'mcp', 'Arcade Omni')
const arcadeSuite = entry('arcade-full-suite', 'mcp', 'Arcade Full Suite')
const linear = entry('linear', 'mcp', 'Linear')
const arcadeApi = entry('arcade-api', 'openapi', 'Arcade API')
const petstore = entry('petstore', 'openapi', 'Swagger Petstore', 'petstore3.swagger.io')
const registry = [arcadeOmni, arcadeSuite, linear, arcadeApi, petstore]

assert.equal(isSourceUrl(''), false)
assert.equal(isSourceUrl('arcade'), false)
assert.equal(isSourceUrl('http'), false)
assert.equal(isSourceUrl('http:'), true)
assert.equal(isSourceUrl('https://'), true)
assert.equal(isSourceUrl('https://omni.arcade.dev/mcp'), true)
assert.equal(isSourceUrl('  HTTPS://example.com  '), true)

assert.equal(parseSourceUrl('arcade'), undefined)
assert.equal(parseSourceUrl('https://'), undefined)
assert.equal(parseSourceUrl('https://omni.arcade.dev/mcp'), 'https://omni.arcade.dev/mcp')

assert.deepEqual(searchRegistry(registry, ''), [])
assert.deepEqual(searchRegistry(registry, '   '), [])

assert.deepEqual(
  searchRegistry(registry, 'arcade').map((item) => item.id),
  ['arcade-api', 'arcade-omni', 'arcade-full-suite'],
)

assert.deepEqual(
  searchRegistry(registry, 'linear').map((item) => item.id),
  ['linear'],
)

assert.deepEqual(searchRegistry(registry, 'petstore3'), [])
assert.deepEqual(
  searchRegistry(registry, 'swagger').map((item) => item.id),
  ['petstore'],
)

const mixed = searchRegistry(registry, 'arcade')
assert.ok(mixed.some((item) => item.kind === 'mcp'))
assert.ok(mixed.some((item) => item.kind === 'openapi'))
assert.ok(mixed.every((item) => /arcade/i.test(item.title)))

assert.deepEqual(
  registryEntries([
    { id: 'recent', title: 'Recent', source: 'recent', items: [] },
    { id: 'mcp', title: 'MCP servers', source: 'catalog', items: [arcadeOmni, linear] },
    { id: 'openapi', title: 'OpenAPI specs', source: 'catalog', items: [arcadeApi] },
  ]).map((item) => item.id),
  ['arcade-omni', 'linear', 'arcade-api'],
)

assert.equal(registrySearchRow(registry, ''), undefined)
assert.equal(registrySearchRow(registry, 'https://omni.arcade.dev/mcp'), undefined)
const searchRow = registrySearchRow(registry, 'arcade')
assert.equal(searchRow?.id, SEARCH_ROW_ID)
assert.deepEqual(
  searchRow?.items.map((item) => item.id),
  ['arcade-api', 'arcade-omni', 'arcade-full-suite'],
)
assert.equal(
  registrySearchRow(registry, 'zzzzz')?.items.length,
  0,
)

console.log('registry search ranking ok')
