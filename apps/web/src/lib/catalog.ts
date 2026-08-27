export type CatalogHotkey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0'

export type CatalogEntry = {
  id: string
  kind: string
  hotkey: CatalogHotkey
  title: string
  detail: string
  url: string
}

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
    hotkey: '6',
    title: 'Arcade API',
    detail: 'api.arcade.dev',
    url: 'https://api.arcade.dev/v1/swagger',
  },
  {
    id: 'openai',
    kind: 'openapi',
    hotkey: '7',
    title: 'OpenAI',
    detail: 'openai/openai-openapi',
    url: 'https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json',
  },
  {
    id: 'anthropic',
    kind: 'openapi',
    hotkey: '8',
    title: 'Anthropic',
    detail: 'api-evangelist/anthropic',
    url: 'https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml',
  },
  {
    id: 'openrouter',
    kind: 'openapi',
    hotkey: '9',
    title: 'OpenRouter',
    detail: 'openrouter.ai',
    url: 'https://openrouter.ai/openapi.json',
  },
  {
    id: 'petstore',
    kind: 'openapi',
    hotkey: '0',
    title: 'Swagger Petstore',
    detail: 'petstore3.swagger.io',
    url: 'https://petstore3.swagger.io/api/v3/openapi.json',
  },
]

export const CATALOG: readonly CatalogEntry[] = [...MCP_CATALOG, ...OPENAPI_CATALOG]

export function catalogActionId(entry: CatalogEntry) {
  return `launch-${entry.id}`
}

export function sourceUrlKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    const path =
      parsed.pathname.endsWith('/') && parsed.pathname !== '/'
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname
    return `${parsed.origin}${path}`.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}
