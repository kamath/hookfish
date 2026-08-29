import assert from 'node:assert/strict'
import { configureApp } from '../config'
import { API_BASE_URL } from './api'
import { getCarouselCatalog, OPENAPI_CATALOG } from './catalog-data'
import { catalogSourceUrl } from './catalog'

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
  OPENAPI_CATALOG.some((entry) => entry.id === 'openrouter'),
  false,
)
assert.equal(OPENAPI_CATALOG[1]?.url, `${API_BASE_URL}/openapi.json`)
assert.equal(
  catalogSourceUrl(OPENAPI_CATALOG[1]!),
  'http://localhost/api/openapi.json',
)

configureApp({ apiBaseUrl: 'https://backend.test/v1/' })
const configuredEntry = getCarouselCatalog()
  .flatMap((row) => row.items)
  .find((entry) => entry.id === 'smithery-api')
assert.equal(configuredEntry?.url, 'https://backend.test/v1/openapi.json')

console.log('openapi catalog order ok')
