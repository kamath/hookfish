import { createServerFn } from '@tanstack/react-start'
import { MCP_CATALOG, OPENAPI_CATALOG } from './catalog.server'
import type { CatalogEntry } from './catalog'

export type CatalogCarouselRow = {
  id: 'recent' | 'mcp' | 'openapi'
  title: string
  items: readonly CatalogEntry[]
}

export const getCarouselCatalog = createServerFn({ method: 'GET' }).handler(
  (): CatalogCarouselRow[] => [
    {
      id: 'recent',
      title: 'Recent',
      items: [],
    },
    {
      id: 'mcp',
      title: 'MCP servers',
      items: MCP_CATALOG,
    },
    {
      id: 'openapi',
      title: 'OpenAPI specs',
      items: OPENAPI_CATALOG,
    },
  ],
)
