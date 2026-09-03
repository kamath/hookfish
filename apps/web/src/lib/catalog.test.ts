import assert from 'node:assert/strict'
import { mountApi } from '@hookfish/api'
import { catalogSourceUrl, getCarouselCatalog } from './catalog'
import { getApi } from './api'

const api = mountApi('/api')
const originalFetch = globalThis.fetch
globalThis.fetch = ((input, init) =>
  api.request(input, init as RequestInit)) as typeof fetch

Object.defineProperty(globalThis, 'window', {
  value: { location: { origin: 'http://localhost' } },
  configurable: true,
})

try {
  assert.equal(
    getApi().catalog.$url().toString(),
    'http://localhost/api/catalog',
  )
  const lists = await getCarouselCatalog()
  assert.deepEqual(
    lists.map((list) => [list.id, list.title, list.source]),
    [
      ['recent', 'Recent', 'recent'],
      ['mcp', 'MCP servers', 'catalog'],
      ['openapi', 'OpenAPI specs', 'catalog'],
    ],
  )
  assert.deepEqual(lists[0]?.items, [])
  const smithery = lists[2]?.items.find((entry) => entry.id === 'smithery-api')
  assert.equal(smithery?.url, '/api/openapi.json')
  assert.equal(catalogSourceUrl(smithery!), 'http://localhost/api/openapi.json')
  assert.equal(
    lists[2]?.items.some((entry) => entry.id === 'openrouter'),
    false,
  )
} finally {
  globalThis.fetch = originalFetch
}

console.log('openapi catalog order ok')
