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

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function indentBlock(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${pad}${line}`))
    .join('\n')
}

function jsOptions(request: ExecuteRequest): string | undefined {
  const fields: string[] = []
  if (request.method !== 'GET') {
    fields.push(`method: ${JSON.stringify(request.method)}`)
  }
  const headers = headerList(request)
  if (headers.length > 0) {
    fields.push(`headers: ${indentBlock(prettyJson(Object.fromEntries(headers)), 2)}`)
  }
  if (request.body) {
    const json = jsonBody(request)
    if (json !== undefined) {
      fields.push(`body: JSON.stringify(${indentBlock(prettyJson(json), 2)})`)
    } else {
      fields.push(`body: ${JSON.stringify(request.body)}`)
    }
  }
  if (fields.length === 0) {
    return undefined
  }
  return `{\n  ${fields.join(',\n  ')},\n}`
}

export function toFetch(request: ExecuteRequest): string {
  const options = jsOptions(request)
  if (!options) {
    return `await fetch(${JSON.stringify(request.url)})`
  }
  return `await fetch(${JSON.stringify(request.url)}, ${options})`
}
