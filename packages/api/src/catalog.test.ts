import assert from 'node:assert/strict'
import { catalogLists, OPENAPI_CATALOG, ownOpenApiCatalogUrl } from './catalog'

assert.equal(ownOpenApiCatalogUrl('http://localhost/catalog'), '/openapi.json')
assert.equal(ownOpenApiCatalogUrl('http://localhost/api/catalog'), '/api/openapi.json')
assert.equal(ownOpenApiCatalogUrl('http://localhost/api/catalog?x=1'), '/api/openapi.json')

const lists = catalogLists('http://localhost/api/catalog')
assert.deepEqual(
  lists.map((list) => [list.id, list.title, list.source]),
  [
    ['recent', 'Recent', 'recent'],
    ['mcp', 'MCP servers', 'catalog'],
    ['openapi', 'OpenAPI specs', 'catalog'],
  ],
)
assert.deepEqual(lists[0]?.items, [])
assert.equal(lists[1]?.items.length, 5)
assert.deepEqual(
  OPENAPI_CATALOG.map((entry) => [entry.hotkey, entry.id, entry.title]),
  [
    ['1', 'arcade-api', 'Arcade API'],
    ['2', 'smithery-api', 'Smithery API'],
    ['3', 'petstore', 'Swagger Petstore'],
    ['4', 'openai', 'OpenAI'],
    ['5', 'anthropic', 'Anthropic'],
  ],
)
assert.equal(
  lists[2]?.items.find((entry) => entry.id === 'smithery-api')?.url,
  '/api/openapi.json',
)
assert.equal(
  lists[2]?.items.some((entry) => entry.id === 'openrouter'),
  false,
)

console.log('catalog lists ok')
