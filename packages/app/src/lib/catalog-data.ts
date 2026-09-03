import type { RegistryFeed } from '@hookfish/api'
import { apiJson, getApi } from './api'
import type { CatalogEntry } from './catalog'
import type { CarouselListContract } from './carousel'

function suggestionDetail(url: string) {
  if (url.startsWith('/')) {
    return url
  }
  try {
    return new URL(url, 'http://localhost').hostname || url
  } catch {
    return url
  }
}

function catalogEntry(suggestion: RegistryFeed[string][number]): CatalogEntry {
  return {
    id: suggestion.url,
    kind: suggestion.type === 'MCP' ? 'mcp' : 'openapi',
    title: suggestion.title,
    detail: suggestionDetail(suggestion.url),
    url: suggestion.url,
  }
}

export function registryFeedToCarousel(feed: RegistryFeed): CarouselListContract[] {
  return [
    {
      id: 'recent',
      title: 'Recent',
      source: 'recent',
      items: [],
    },
    ...Object.entries(feed).map(([categoryName, suggestions]) => ({
      id: categoryName,
      title: categoryName,
      source: 'catalog',
      items: suggestions.map(catalogEntry),
    }) satisfies CarouselListContract),
  ]
}

export async function getCarouselCatalog() {
  const feed = await apiJson<RegistryFeed>(
    await getApi().registry.feed.$get(),
  )
  return registryFeedToCarousel(feed)
}
