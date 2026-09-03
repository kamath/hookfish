import { apiJson, getApi } from './api'
import type { CarouselListContract } from './carousel'

export type CatalogHotkey = '1' | '2' | '3' | '4' | '5'

export type CatalogEntry = {
  id: string
  kind: string
  hotkey: CatalogHotkey
  title: string
  detail: string
  url: string
}

export function carouselActionId(index: number) {
  return `carousel-${index + 1}`
}

export function catalogSourceUrl(entry: CatalogEntry) {
  return new URL(
    entry.url,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  ).toString()
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

export async function getCarouselCatalog(): Promise<CarouselListContract[]> {
  const response = await getApi().catalog.$get()
  const body = await apiJson<{ lists: CarouselListContract[] }>(response)
  return body.lists
}
