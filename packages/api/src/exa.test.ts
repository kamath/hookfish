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
    },
    {
      url: 'https://mcp.notion.com/mcp',
      title: 'Notion',
      type: 'MCP',
      homepage: undefined,
      description: undefined,
    },
  ],
)

console.log('exa structured output parses into MCP results')
