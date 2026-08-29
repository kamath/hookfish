import type { CatalogEntry } from './catalog'

export const MAX_CAROUSEL_ITEMS = 5

export type CarouselListContract = {
  id: string
  title: string
  source: 'recent' | 'catalog'
  items: readonly CatalogEntry[]
}

export function visibleCarouselItems<T>(items: readonly T[]): readonly T[] {
  return items.slice(0, MAX_CAROUSEL_ITEMS)
}

export function wrappedCarouselIndex(index: number, delta: number, length: number) {
  if (length <= 0) {
    return 0
  }
  return (index + delta + length) % length
}
