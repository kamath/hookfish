export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function omitEmpty(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined
  }

  if (Array.isArray(value)) {
    const items = value.map(omitEmpty).filter((item) => item !== undefined)
    return items.length > 0 ? items : undefined
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, omitEmpty(item)] as const)
      .filter(([, item]) => item !== undefined)

    if (entries.length === 0) {
      return undefined
    }

    return Object.fromEntries(entries)
  }

  return value
}

function appendQuery(url: URL, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item !== undefined && item !== null && item !== '') {
        url.searchParams.append(key, String(item))
      }
    }
    return
  }

  url.searchParams.set(key, String(value))
}

export function interpolatePath(
  path: string,
  params: Record<string, unknown> | undefined,
): string {
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params?.[name]
    if (value === undefined || value === null || value === '') {
      return `{${name}}`
    }
    return encodeURIComponent(String(value))
  })
}

export function buildRequestUrl(
  serverUrl: string,
  path: string,
  pathParams?: Record<string, unknown>,
  query?: Record<string, unknown>,
): string {
  const base = serverUrl.replace(/\/$/, '')
  const resolvedPath = interpolatePath(path, pathParams)
  const url = new URL(
    resolvedPath.startsWith('http') ? resolvedPath : `${base}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`,
  )

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      appendQuery(url, key, value)
    }
  }

  return url.toString()
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
