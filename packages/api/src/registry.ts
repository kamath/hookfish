import type { RegistryFeed } from './schemas'

// MCP servers alternate between Arcade-hosted and first-party.
export const registryFeed: RegistryFeed = {
  'MCP Servers': [
    { url: 'https://server.smithery.ai/gmail', title: 'Gmail (Arcade)', type: 'MCP' },
    { url: 'https://mcp.linear.app/mcp', title: 'Linear', type: 'MCP' },
    {
      url: 'https://server.smithery.ai/googlecalendar',
      title: 'Google Calendar (Arcade)',
      type: 'MCP',
    },
    { url: 'https://mcp.notion.com/mcp', title: 'Notion', type: 'MCP' },
    { url: 'https://server.smithery.ai/slack', title: 'Slack (Arcade)', type: 'MCP' },
  ],
  APIs: [
    {
      url: 'https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml',
      title: 'Anthropic',
      type: 'API',
    },
    { url: 'https://api.arcade.dev/v1/swagger', title: 'Arcade API', type: 'API' },
    { url: '/api/openapi.json', title: 'Hookfish API', type: 'API' },
    {
      url: 'https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json',
      title: 'OpenAI',
      type: 'API',
    },
    {
      url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      title: 'Swagger Petstore',
      type: 'API',
    },
  ],
}
