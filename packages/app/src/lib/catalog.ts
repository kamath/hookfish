export type CatalogEntry = {
  id: string
  kind?: string
  title: string
  detail: string
  url: string
  description?: string
  /** How the source authenticates, when known (web search results). */
  auth?: 'none' | 'oauth' | 'headers' | 'unknown'
  /** Headers the source requires; the launcher pre-fills them for the user to complete. */
  headers?: readonly string[]
}

export function catalogAuthLabel(entry: CatalogEntry): string | undefined {
  switch (entry.auth) {
    case 'none':
      return 'no auth'
    case 'oauth':
      return 'OAuth'
    case 'headers': {
      const headers = entry.headers ?? []
      return headers.length > 0 ? headers.join(', ') : 'headers'
    }
    default:
      return undefined
  }
}

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
