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

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function toCurl(request: ExecuteRequest): string {
  const lines = [`curl ${shellSingleQuote(request.url)}`]
  if (request.method !== 'GET') {
    lines.push(`  -X ${request.method}`)
  }
  for (const [name, value] of headerList(request)) {
    lines.push(`  -H ${shellSingleQuote(`${name}: ${value}`)}`)
  }
  if (request.body) {
    const json = jsonBody(request)
    const payload =
      json === undefined ? request.body : JSON.stringify(json, null, 2)
    lines.push(`  --data-raw ${shellSingleQuote(payload)}`)
  }
  if (lines.length === 1) {
    return lines[0] ?? 'curl'
  }
  return lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \\`))
    .join('\n')
}
