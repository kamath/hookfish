import assert from 'node:assert/strict'
import { hintSourceKind, neitherSourceError, sourceProbeOrder } from './source-kind.ts'

assert.equal(hintSourceKind('https://mcp.linear.app/mcp'), 'mcp')
assert.equal(hintSourceKind('https://mcp.notion.com/mcp'), 'mcp')
assert.equal(hintSourceKind('https://omni.arcade.dev/mcp'), 'mcp')
assert.equal(hintSourceKind('https://api.bosslevel.dev/mcp/gw_3F3PbNNz9DdEJ6zdHqbegVC7mMo'), 'mcp')
assert.equal(hintSourceKind('https://example.com/v1/mcp/'), 'mcp')

assert.equal(hintSourceKind('https://petstore3.swagger.io/api/v3/openapi.json'), 'openapi')
assert.equal(hintSourceKind('https://api.arcade.dev/v1/swagger'), 'openapi')
assert.equal(
  hintSourceKind(
    'https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json',
  ),
  'openapi',
)
assert.equal(
  hintSourceKind(
    'https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml',
  ),
  'openapi',
)
assert.equal(hintSourceKind('https://example.com/spec.yaml'), 'openapi')
assert.equal(hintSourceKind('https://example.com/openapi'), 'openapi')

assert.equal(hintSourceKind('https://server.smithery.ai/gmail'), undefined)
assert.equal(hintSourceKind('https://example.com/api'), undefined)
assert.equal(hintSourceKind('https://example.com/mcp/openapi.json'), undefined)
assert.equal(hintSourceKind('not a url'), undefined)

assert.deepEqual(sourceProbeOrder('https://mcp.linear.app/mcp'), ['mcp', 'openapi'])
assert.deepEqual(sourceProbeOrder('https://example.com/openapi.json'), ['openapi', 'mcp'])
assert.deepEqual(sourceProbeOrder('https://server.smithery.ai/gmail'), ['openapi', 'mcp'])
assert.deepEqual(sourceProbeOrder('https://example.com/mcp/openapi.json'), ['openapi', 'mcp'])

assert.equal(
  neitherSourceError([new Error('Could not fetch the spec (404).')]).message,
  'This URL is not an OpenAPI document or an MCP server.',
)
assert.equal(
  neitherSourceError([
    new Error('Likely CORS error. Cloud mode may help.'),
    new Error('Error POSTing to endpoint'),
  ]).message,
  'Likely CORS error. Cloud mode may help.',
)

console.log('source kind inference ok')
