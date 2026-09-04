import type { CatalogEntry } from './catalog'
import type { CarouselListContract } from './carousel'
import { fuzzyScore } from './fuzzy'

/** True when the input is a URL or a URL being typed, not a registry search. */
export function isSourceUrl(value: string) {
  return /^https?:/i.test(value.trim())
}

export function parseSourceUrl(value: string): string | undefined {
  const trimmed = value.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed
    }
  } catch {
    return undefined
  }
}

export function registryEntries(
  rows: readonly CarouselListContract[],
): CatalogEntry[] {
  return rows.flatMap((row) => (row.source === 'catalog' ? [...row.items] : []))
}

/** Rank catalog entries by fuzzy title match. Higher scores come first. */
export function searchRegistry(
  entries: readonly CatalogEntry[],
  query: string,
): CatalogEntry[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  return entries
    .map((entry) => ({ entry, score: fuzzyScore(entry.title, trimmed) }))
    .filter((item): item is { entry: CatalogEntry; score: number } => item.score != null)
    .sort(
      (left, right) =>
        right.score - left.score || left.entry.title.localeCompare(right.entry.title),
    )
    .map((item) => item.entry)
}

export const SEARCH_ROW_ID = 'search'

export function registrySearchRow(
  entries: readonly CatalogEntry[],
  query: string,
): { id: typeof SEARCH_ROW_ID; title: 'Search'; items: CatalogEntry[] } | undefined {
  const trimmed = query.trim()
  if (!trimmed || isSourceUrl(trimmed)) {
    return undefined
  }
  return {
    id: SEARCH_ROW_ID,
    title: 'Search',
    items: searchRegistry(entries, trimmed),
  }
}
