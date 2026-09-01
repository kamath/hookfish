import assert from 'node:assert/strict'
import { registryEntryMetadata } from './apis'
import type { ClientApi } from './client-types'

const source: ClientApi = {
  id: 'source-1',
  kind: 'mcp',
  title: 'Widget MCP',
  sourceUrl: 'https://mcp.test?token=secret',
  targets: ['https://mcp.test?token=secret'],
  executables: [
    {
      id: 'tool:read_widget',
      name: 'read_widget',
      badge: 'TOOL',
      accent: 'blue',
      groups: ['Tools'],
      binding: {
        type: 'mcp',
        kind: 'tool',
        method: 'tools/call',
        name: 'read_widget',
      },
      inputSchema: { type: 'object' },
      inputUiSchema: {},
    },
  ],
  groups: [{ name: 'Tools' }],
  labels: {
    source: 'MCP server',
    sourcePlural: 'MCP servers',
    executable: 'RPC',
    executablePlural: 'RPCs',
    target: 'Endpoint',
    execute: 'Call',
    executing: 'Calling…',
    executed: 'Call again',
  },
  adapterData: {
    protocolVersion: '2025-11-25',
    sessionId: 'private-session',
    oauthAuthorized: true,
  },
  credentialsStored: true,
}

const cached = registryEntryMetadata(source)
assert.equal(cached?.kind, 'mcp')
assert.equal(cached?.executables[0]?.name, 'read_widget')
assert.deepEqual(cached?.adapterData, {
  protocolVersion: '2025-11-25',
})
assert.equal('sourceUrl' in (cached ?? {}), false)
assert.equal('targets' in (cached ?? {}), false)
assert.equal('credentialsStored' in (cached ?? {}), false)

console.log('api cache tests passed')
