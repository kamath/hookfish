import type { ExecuteRequest } from './invoke'

function headerList(request: ExecuteRequest): Array<[string, string]> {
  return Object.entries(request.headers).filter(
    ([name]) => name.toLowerCase() !== 'content-length',
  )
}

function contentType(request: ExecuteRequest): string {
  for (const [name, value] of headerList(request)) {
    if (name.toLowerCase() === 'content-type') {
      return value
    }
  }
  return ''
}

function jsonBody(request: ExecuteRequest): unknown {
  if (!request.body || !contentType(request).includes('json')) {
    return undefined
  }
  try {
    return JSON.parse(request.body)
  } catch {
    return undefined
  }
}

function jsProperty(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}

export function authPlaceholder(key: string): string {
  const token = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase()
  return `INSERT_${token || 'KEY'}`
}

export function withAuthPlaceholders(
  auth: Record<string, string>,
  keys: readonly string[],
): Record<string, string> {
  const next = { ...auth }
  for (const key of keys) {
    if (!next[key]?.trim()) {
      next[key] = authPlaceholder(key)
    }
  }
  return next
}

export function toFetch(request: ExecuteRequest): string {
  const options: string[] = []
  if (request.method !== 'GET') {
    options.push(`  method: ${JSON.stringify(request.method)},`)
  }

  const headers = headerList(request)
  if (headers.length > 0) {
    options.push('  headers: {')
    for (const [name, value] of headers) {
      options.push(`    ${jsProperty(name)}: ${JSON.stringify(value)},`)
    }
    options.push('  },')
  }

  if (request.body) {
    const json = jsonBody(request)
    if (json === undefined) {
      options.push(`  body: ${JSON.stringify(request.body)},`)
    } else {
      const pretty = JSON.stringify(json, null, 2).replace(/\n/g, '\n  ')
      options.push(`  body: JSON.stringify(${pretty}),`)
    }
  }

  if (options.length === 0) {
    return `fetch(${JSON.stringify(request.url)})`
  }

  return `fetch(${JSON.stringify(request.url)}, {\n${options.join('\n')}\n})`
}
