import assert from 'node:assert/strict'
import { registryFeedToCarousel } from './catalog-data'
import { catalogSourceUrl } from './catalog'

const carousel = registryFeedToCarousel({
  'MCP Servers': [
    {
      url: 'https://mcp.example.test/mcp',
      title: 'Example MCP',
    },
  ],
  OpenAPI: [
    {
      url: '/api/openapi.json',
      title: 'Smithery API',
    },
    {
      url: 'https://petstore.example.test/openapi.json',
      title: 'Petstore',
    },
  ],
})

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
