import type { CatalogEntry, CatalogList } from './schemas'

export const MCP_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'arcade-omni',
    kind: 'mcp',
    hotkey: '1',
    title: 'Arcade Omni',
    detail: 'omni.arcade.dev',
    url: 'https://omni.arcade.dev/mcp',
  },
  {
    id: 'arcade-full-suite',
    kind: 'mcp',
    hotkey: '2',
    title: 'Arcade Full Suite',
    detail: 'api.bosslevel.dev',
    url: 'https://api.bosslevel.dev/mcp/gw_3F3PbNNz9DdEJ6zdHqbegVC7mMo',
  },
  {
    id: 'smithery-gmail',
    kind: 'mcp',
    hotkey: '3',
    title: 'Smithery Gmail',
    detail: 'server.smithery.ai',
    url: 'https://server.smithery.ai/gmail',
  },
  {
    id: 'linear',
    kind: 'mcp',
    hotkey: '4',
    title: 'Linear',
    detail: 'mcp.linear.app',
    url: 'https://mcp.linear.app/mcp',
  },
  {
    id: 'notion',
    kind: 'mcp',
    hotkey: '5',
    title: 'Notion',
    detail: 'mcp.notion.com',
    url: 'https://mcp.notion.com/mcp',
  },
]

export const OPENAPI_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'arcade-api',
    kind: 'openapi',
    hotkey: '1',
    title: 'Arcade API',
    detail: 'api.arcade.dev',
    url: 'https://api.arcade.dev/v1/swagger',
  },
  {
    id: 'smithery-api',
    kind: 'openapi',
    hotkey: '2',
    title: 'Smithery API',
    detail: '/openapi.json',
    url: '/openapi.json',
  },
  {
    id: 'petstore',
    kind: 'openapi',
    hotkey: '3',
    title: 'Swagger Petstore',
    detail: 'petstore3.swagger.io',
    url: 'https://petstore3.swagger.io/api/v3/openapi.json',
  },
  {
    id: 'openai',
    kind: 'openapi',
    hotkey: '4',
    title: 'OpenAI',
    detail: 'openai/openai-openapi',
    url: 'https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json',
  },
  {
    id: 'anthropic',
    kind: 'openapi',
    hotkey: '5',
    title: 'Anthropic',
    detail: 'api-evangelist/anthropic',
    url: 'https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml',
  },
]

export function ownOpenApiCatalogUrl(requestUrl: string) {
  const url = new URL(requestUrl)
  url.search = ''
  url.hash = ''
  const directory = url.pathname.replace(/\/catalog\/?$/, '/')
  url.pathname = directory.endsWith('/') ? `${directory}openapi.json` : `${directory}/openapi.json`
  return url.pathname
}

export function catalogLists(requestUrl: string): CatalogList[] {
  const ownOpenApiPath = ownOpenApiCatalogUrl(requestUrl)
  return [
    {
      id: 'recent',
      title: 'Recent',
      source: 'recent',
      items: [],
    },
    {
      id: 'mcp',
      title: 'MCP servers',
      source: 'catalog',
      items: [...MCP_CATALOG],
    },
    {
      id: 'openapi',
      title: 'OpenAPI specs',
      source: 'catalog',
      items: OPENAPI_CATALOG.map((entry) =>
        entry.id === 'smithery-api'
          ? { ...entry, detail: ownOpenApiPath, url: ownOpenApiPath }
          : entry,
      ),
    },
  ]
}
