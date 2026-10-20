import assert from 'node:assert/strict'
import { exaSearchResults } from './exa'

assert.deepEqual(exaSearchResults({}), [])
assert.deepEqual(exaSearchResults({ output: { content: 'text output' } }), [])

assert.deepEqual(
  exaSearchResults({
    output: {
      content: {
        servers: [
          { name: 'Linear', mcpUrl: 'https://mcp.linear.app/mcp', homepage: 'not a url' },
          { name: 'Linear again', mcpUrl: 'https://mcp.linear.app/mcp' },
          { name: 'No URL' },
          { name: 'Bad scheme', mcpUrl: 'javascript:alert(1)' },
          { mcpUrl: 'https://mcp.example.test/mcp' },
          { name: ' Notion ', mcpUrl: ' https://mcp.notion.com/mcp ', description: ' ' },
        ],
      },
    },
  }),
  [
    {
      url: 'https://mcp.linear.app/mcp',
      title: 'Linear',
      type: 'MCP',
      homepage: undefined,
      description: undefined,
      auth: 'unknown',
      headers: [],
    },
    {
      url: 'https://mcp.notion.com/mcp',
      title: 'Notion',
      type: 'MCP',
      homepage: undefined,
      description: undefined,
      auth: 'unknown',
      headers: [],
    },
  ],
)

function authOf(server: Record<string, unknown>) {
  const [result] = exaSearchResults({
    output: { content: { servers: [{ name: 'S', mcpUrl: 'https://s.test/mcp', ...server }] } },
  })
  return { auth: result?.auth, headers: result?.headers }
}

assert.deepEqual(authOf({ authType: 'none' }), { auth: 'none', headers: [] })
assert.deepEqual(authOf({ authType: 'oauth' }), { auth: 'oauth', headers: [] })
assert.deepEqual(authOf({ authType: 'magic' }), { auth: 'unknown', headers: [] })
// A token server that names no header gets Authorization.
assert.deepEqual(authOf({ authType: 'headers' }), { auth: 'headers', headers: ['Authorization'] })
// OAuth and no-auth ignore any headers listed alongside them.
assert.deepEqual(authOf({ authType: 'oauth', requiredHeaders: ['X-API-Key'] }), {
  auth: 'oauth',
  headers: [],
})
// Named headers imply header auth, are deduplicated, and drop invalid or forbidden names.
assert.deepEqual(
  authOf({
    requiredHeaders: ['X-API-Key', 'x-api-key', 'Bad Header', 'Host', 'X-Workspace', 7],
  }),
  { auth: 'headers', headers: ['X-API-Key', 'X-Workspace'] },
)

// Several credential headers collapse to one, preferring Authorization.
assert.deepEqual(
  authOf({
    authType: 'headers',
    requiredHeaders: ['CONTEXT7_API_KEY', 'Authorization', 'X-API-Key', 'X-Workspace'],
  }),
  { auth: 'headers', headers: ['Authorization', 'X-Workspace'] },
)
assert.deepEqual(
  authOf({ authType: 'headers', requiredHeaders: ['X-API-Key', 'X-Access-Token'] }),
  { auth: 'headers', headers: ['X-API-Key'] },
)

console.log('exa structured output parses into MCP results')
