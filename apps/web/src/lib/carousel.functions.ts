import { createServerFn } from '@tanstack/react-start'
import { MCP_CATALOG, OPENAPI_CATALOG } from './catalog.server'
import type { CarouselListContract } from './carousel'

export const getCarouselCatalog = createServerFn({ method: 'GET' }).handler(
  (): CarouselListContract[] => [
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
      items: MCP_CATALOG,
    },
    {
      id: 'openapi',
      title: 'OpenAPI specs',
      source: 'catalog',
      items: OPENAPI_CATALOG,
    },
  ],
)
