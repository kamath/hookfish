import type { SuggestedSource } from '@hookfish/api'
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

function catalogEntry(suggestion: SuggestedSource): CatalogEntry {
  return {
    id: suggestion.url,
    title: suggestion.title,
    detail: suggestionDetail(suggestion.url),
    url: suggestion.url,
  }
}

export function suggestionsToCarousel(
  suggestions: readonly SuggestedSource[],
): CarouselListContract[] {
  const categories = new Map<string, CatalogEntry[]>()
  for (const suggestion of suggestions) {
    const entries = categories.get(suggestion.category_name) ?? []
    entries.push(catalogEntry(suggestion))
    categories.set(suggestion.category_name, entries)
  }

  return [
    {
      id: 'recent',
      title: 'Recent',
      source: 'recent',
      items: [],
    },
    ...Array.from(categories, ([categoryName, items]) => ({
      id: categoryName,
      title: categoryName,
      source: 'catalog',
      items,
    }) satisfies CarouselListContract),
  ]
}

export async function getCarouselCatalog() {
  const response = await apiJson<{ suggestions: SuggestedSource[] }>(
    await getApi().suggestions.$get(),
  )
  return suggestionsToCarousel(response.suggestions)
}
