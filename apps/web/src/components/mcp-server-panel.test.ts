import assert from 'node:assert/strict'
import { mcpTransportLabel } from './mcp-server-panel.tsx'

assert.equal(mcpTransportLabel('modern', undefined), 'modern/stateless')
assert.equal(mcpTransportLabel('modern', 'abc123def'), 'modern/stateful')
assert.equal(mcpTransportLabel('legacy', undefined), 'legacy SHTTP/stateless')
assert.equal(mcpTransportLabel('legacy', 'legacy-session'), 'legacy SHTTP/stateful')

console.log('mcp transport label ok')
