import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { ExecutableSource } from '../lib/client-types.ts'
import { McpServerPanel, mcpChromeFacts, mcpTransportLabel } from './mcp-server-panel.tsx'

assert.equal(mcpTransportLabel('modern', undefined), 'modern/stateless')
assert.equal(mcpTransportLabel('modern', 'abc123def'), 'modern/stateful')
assert.equal(mcpTransportLabel('legacy', undefined), 'legacy SHTTP/stateless')
assert.equal(mcpTransportLabel('legacy', 'legacy-session'), 'legacy SHTTP/stateful')
assert.deepEqual(
  mcpChromeFacts({
    era: 'modern',
    protocolVersion: '2026-07-28',
    oauthAuthorized: true,
    serverInfo: { version: '1.2.0' },
  }).map((fact) => fact.text),
  ['MCP 2026-07-28', 'modern/stateless', 'OAuth', 'server 1.2.0'],
)

const labels = {
  source: 'MCP server',
  sourcePlural: 'MCP servers',
  executable: 'RPC',
  executablePlural: 'RPCs',
  target: 'Endpoint',
  execute: 'Call',
  executing: 'Calling…',
  executed: 'Call again',
}

function source(adapterData: unknown): ExecutableSource {
  return {
    id: 'src',
    kind: 'mcp',
    title: 'Test',
    sourceUrl: 'https://mcp.test',
    targets: ['https://mcp.test'],
    executables: [
      {
        id: 'tool:echo',
        name: 'echo',
        badge: 'TOOL',
        accent: 'var(--accent-mcp-tool)',
        groups: ['Tools'],
        binding: { type: 'mcp', kind: 'tool', method: 'tools/call', name: 'echo' },
        inputSchema: { type: 'object' },
        inputUiSchema: {},
      },
    ],
    groups: [],
    labels,
    adapterData,
  }
}

const stateless = renderToString(
  createElement(McpServerPanel, {
    source: source({
      era: 'modern',
      protocolVersion: '2026-07-28',
      capabilities: { tools: {} },
    }),
  }),
)
assert.match(stateless, /MCP 2026-07-28/)
assert.match(stateless, / · /)
assert.match(stateless, /modern\/stateless/)
assert.match(stateless, /prompts/)
assert.match(stateless, /traces/)
assert.doesNotMatch(stateless, /OAuth/)
assert.doesNotMatch(stateless, /sessionless/)
assert.doesNotMatch(stateless, /bg-paper[^"]*">OAuth/)
assert.match(stateless, /bg-paper text-mute hover:text-ink/)
assert.doesNotMatch(stateless, /ml-auto/)

const stateful = renderToString(
  createElement(McpServerPanel, {
    source: source({
      era: 'legacy',
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      sessionId: 'legacy-session',
      oauthAuthorized: true,
      serverInfo: { version: '1.0.0' },
    }),
  }),
)
assert.match(stateful, /legacy SHTTP\/stateful/)
assert.match(stateful, / · /)
assert.match(stateful, /OAuth/)
assert.match(stateful, /server 1.0.0/)
assert.match(stateful, /title="legacy-session"/)
assert.doesNotMatch(stateful, /bg-paper[^"]*">OAuth/)
assert.doesNotMatch(stateful, /sessionless/)

console.log('mcp transport label ok')

