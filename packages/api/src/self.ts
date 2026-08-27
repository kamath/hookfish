const INTERNAL_ORIGIN = 'http://hookfish.internal'

export const INTERNAL_FETCH_HEADER = 'x-hookfish-internal'

export function apiMountPrefix(requestUrl: string): string {
  const pathname = new URL(requestUrl).pathname
  const slash = pathname.lastIndexOf('/')
  return slash <= 0 ? '' : pathname.slice(0, slash)
}

export function ownApiPath(targetUrl: string, requestUrl: string): string | undefined {
  try {
    const request = new URL(requestUrl)
    const target = new URL(targetUrl, request)
    if (target.protocol !== request.protocol || target.host !== request.host) {
      return undefined
    }
    const prefix = apiMountPrefix(requestUrl)
    if (prefix) {
      if (target.pathname !== prefix && !target.pathname.startsWith(`${prefix}/`)) {
        return undefined
      }
      return `${target.pathname.slice(prefix.length) || '/'}${target.search}`
    }
    return `${target.pathname}${target.search}`
  } catch {
    return undefined
  }
}

export function isOwnOpenApiUrl(specUrl: string, requestUrl: string): boolean {
  const path = ownApiPath(specUrl, requestUrl)
  if (!path) {
    return false
  }
  const pathname = path.split('?')[0]?.replace(/\/+$/, '') ?? ''
  return pathname === '/openapi.json'
}

export function ownApiRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  requestUrl: string,
): Request | undefined {
  const targetUrl = input instanceof Request ? input.url : String(input)
  const path = ownApiPath(targetUrl, requestUrl)
  if (path === undefined) {
    return undefined
  }
  const url = new URL(path, INTERNAL_ORIGIN)
  return input instanceof Request ? new Request(url, input) : new Request(url, init)
}

export function withInternalFetchHeader(request: Request): Request {
  const headers = new Headers(request.headers)
  headers.set(INTERNAL_FETCH_HEADER, '1')
  return new Request(request, { headers })
}
