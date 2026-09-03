import assert from 'node:assert/strict'
import { suggestionsToCarousel } from './catalog-data'
import { catalogSourceUrl } from './catalog'

const carousel = suggestionsToCarousel([
  {
    url: 'https://mcp.example.test/mcp',
    title: 'Example MCP',
    category_name: 'MCP Servers',
  },
  {
    url: '/api/openapi.json',
    title: 'Smithery API',
    category_name: 'OpenAPI',
  },
  {
    url: 'https://petstore.example.test/openapi.json',
    title: 'Petstore',
    category_name: 'OpenAPI',
  },
])

assert.deepEqual(
  carousel.map((row) => [row.id, row.title, row.items.length]),
  [
    ['recent', 'Recent', 0],
    ['MCP Servers', 'MCP Servers', 1],
    ['OpenAPI', 'OpenAPI', 2],
  ],
)
assert.equal(carousel[1]?.items[0]?.detail, 'mcp.example.test')
assert.equal(carousel[2]?.items[0]?.detail, '/api/openapi.json')
assert.equal(
  catalogSourceUrl(carousel[2]!.items[0]!),
  'http://localhost/api/openapi.json',
)

console.log('database suggestions group into category panes')
