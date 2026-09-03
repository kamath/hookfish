import assert from 'node:assert/strict'
import { API_BASE_URL } from './api'
import { OPENAPI_CATALOG, catalogSourceUrl } from './catalog'

assert.deepEqual(
  OPENAPI_CATALOG.map((entry) => [entry.hotkey, entry.id, entry.title]),
  [
    ['6', 'arcade-api', 'Arcade API'],
    ['7', 'smithery-api', 'Smithery API'],
    ['8', 'petstore', 'Swagger Petstore'],
    ['9', 'openai', 'OpenAI'],
    ['0', 'anthropic', 'Anthropic'],
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

console.log('openapi catalog order ok')
