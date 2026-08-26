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
