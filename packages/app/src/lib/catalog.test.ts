import assert from 'node:assert/strict'
import { registryFeedToCarousel, registrySearchToEntries } from './catalog-data'
import { catalogAuthLabel, catalogSourceUrl } from './catalog'

const carousel = registryFeedToCarousel({
  'MCP Servers': [
    {
      url: 'https://mcp.example.test/mcp',
      title: 'Example MCP',
      type: 'MCP',
    },
  ],
  OpenAPI: [
    {
      url: '/api/openapi.json',
      title: 'Hookfish API',
      type: 'API',
    },
    {
      url: 'https://petstore.example.test/openapi.json',
      title: 'Petstore',
      type: 'API',
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
assert.equal(carousel[1]?.items[0]?.kind, 'mcp')
assert.equal(carousel[2]?.items[0]?.detail, '/api/openapi.json')
assert.equal(carousel[2]?.items[0]?.kind, 'openapi')
assert.equal(
  catalogSourceUrl(carousel[2]!.items[0]!),
  'http://localhost/api/openapi.json',
)

assert.deepEqual(
  registrySearchToEntries({
    results: [
      {
        url: 'https://mcp.linear.app/mcp',
        title: 'Linear MCP Server',
        type: 'MCP',
        description: 'Read and write Linear issues.',
        auth: 'headers',
        headers: ['Authorization'],
      },
    ],
  }),
  [
    {
      id: 'https://mcp.linear.app/mcp',
      kind: 'mcp',
      title: 'Linear MCP Server',
      detail: 'mcp.linear.app',
      url: 'https://mcp.linear.app/mcp',
      description: 'Read and write Linear issues.',
      auth: 'headers',
      headers: ['Authorization'],
    },
  ],
)

assert.equal(catalogAuthLabel({ id: 'a', title: 'A', detail: 'a', url: 'https://a', auth: 'oauth' }), 'OAuth')
assert.equal(catalogAuthLabel({ id: 'a', title: 'A', detail: 'a', url: 'https://a', auth: 'none' }), 'no auth')
assert.equal(
  catalogAuthLabel({
    id: 'a',
    title: 'A',
    detail: 'a',
    url: 'https://a',
    auth: 'headers',
    headers: ['X-API-Key', 'X-Workspace'],
  }),
  'X-API-Key, X-Workspace',
)
assert.equal(catalogAuthLabel({ id: 'a', title: 'A', detail: 'a', url: 'https://a' }), undefined)

console.log('suggestions group into category panes and web results become entries')
