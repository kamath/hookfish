import { API_BASE_URL } from './api'

export type CatalogHotkey = '1' | '2' | '3' | '4' | '5'

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
    detail: `${API_BASE_URL}/openapi.json`,
    url: `${API_BASE_URL}/openapi.json`,
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

export const CATALOG: readonly CatalogEntry[] = [...MCP_CATALOG, ...OPENAPI_CATALOG]

export function carouselActionId(index: number) {
  return `carousel-${index + 1}`
}

export function catalogSourceUrl(entry: CatalogEntry) {
  return new URL(entry.url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).toString()
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
