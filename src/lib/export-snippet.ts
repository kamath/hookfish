import type { ExecuteRequest } from './invoke'

export const SNIPPET_FORMATS = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'fetch' },
  { id: 'axios', label: 'axios' },
  { id: 'requests', label: 'requests' },
  { id: 'httpx', label: 'httpx' },
  { id: 'httpie', label: 'HTTPie' },
] as const

export type SnippetFormat = (typeof SNIPPET_FORMATS)[number]['id']

const FORMAT_IDS = new Set<string>(SNIPPET_FORMATS.map((format) => format.id))

export function isSnippetFormat(value: string): value is SnippetFormat {
  return FORMAT_IDS.has(value)
}

export function renderSnippet(
  format: SnippetFormat,
  request: ExecuteRequest,
): string {
  switch (format) {
    case 'curl':
      return toCurl(request)
    case 'fetch':
      return toFetch(request)
    case 'axios':
      return toAxios(request)
    case 'requests':
      return toPython(request, 'requests')
    case 'httpx':
      return toPython(request, 'httpx')
    case 'httpie':
      return toHttpie(request)
  }
}

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

function parsedJson(body: string | undefined): unknown {
  if (!body) {
    return undefined
  }
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function jsonBody(request: ExecuteRequest): unknown {
  if (!contentType(request).includes('json')) {
    return undefined
  }
  return parsedJson(request.body)
}

function formBody(request: ExecuteRequest): Record<string, string> | undefined {
  if (!request.body || !contentType(request).includes('application/x-www-form-urlencoded')) {
    return undefined
  }
  return Object.fromEntries(new URLSearchParams(request.body))
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function indentBlock(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${pad}${line}`))
    .join('\n')
}

function toPythonLiteral(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 4)
  if (value === null) {
    return 'None'
  }
  if (value === true) {
    return 'True'
  }
  if (value === false) {
    return 'False'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
    const items = value.map((item) => `${inner}${toPythonLiteral(item, indent + 4)},`)
    return `[\n${items.join('\n')}\n${pad}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return '{}'
    }
    const items = entries.map(
      ([key, item]) => `${inner}${JSON.stringify(key)}: ${toPythonLiteral(item, indent + 4)},`,
    )
    return `{\n${items.join('\n')}\n${pad}}`
  }
  return JSON.stringify(String(value))
}

function pythonHeaders(request: ExecuteRequest, indent = 4): string | undefined {
  const headers = headerList(request)
  if (headers.length === 0) {
    return undefined
  }
  return `headers=${toPythonLiteral(Object.fromEntries(headers), indent)}`
}

function pythonCall(
  client: 'requests' | 'httpx',
  request: ExecuteRequest,
): string {
  const method = request.method.toLowerCase()
  const known = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
  const args = [JSON.stringify(request.url)]
  const headers = pythonHeaders(request, 4)
  if (headers) {
    args.push(headers)
  }
  const json = jsonBody(request)
  if (json !== undefined) {
    args.push(`json=${toPythonLiteral(json, 4)}`)
  } else {
    const form = formBody(request)
    if (form) {
      args.push(`data=${toPythonLiteral(form, 4)}`)
    } else if (request.body) {
      args.push(`data=${JSON.stringify(request.body)}`)
    }
  }

  if (args.length === 1 && known.includes(method)) {
    return `${client}.${method}(${args[0]})`
  }

  const formatted =
    args.length === 1
      ? args[0]
      : `\n    ${args.join(',\n    ')},\n`
  if (known.includes(method)) {
    return `${client}.${method}(${formatted})`
  }
  return `${client}.request(${JSON.stringify(request.method)}, ${formatted})`
}

function toPython(request: ExecuteRequest, client: 'requests' | 'httpx'): string {
  return `import ${client}\n\nresponse = ${pythonCall(client, request)}`
}

function toCurl(request: ExecuteRequest): string {
  const lines = [`curl ${shellSingleQuote(request.url)}`]
  if (request.method !== 'GET') {
    lines.push(`  -X ${request.method}`)
  }
  for (const [name, value] of headerList(request)) {
    lines.push(`  -H ${shellSingleQuote(`${name}: ${value}`)}`)
  }
  if (request.body) {
    const json = jsonBody(request)
    const payload = json === undefined ? request.body : prettyJson(json)
    lines.push(`  --data-raw ${shellSingleQuote(payload)}`)
  }
  if (lines.length === 1) {
    return lines[0] ?? 'curl'
  }
  return lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \\`))
    .join('\n')
}

function jsObject(value: unknown): string {
  return prettyJson(value)
}

function jsOptions(request: ExecuteRequest): string | undefined {
  const fields: string[] = []
  if (request.method !== 'GET') {
    fields.push(`method: ${JSON.stringify(request.method)}`)
  }
  const headers = headerList(request)
  if (headers.length > 0) {
    fields.push(`headers: ${indentBlock(jsObject(Object.fromEntries(headers)), 2)}`)
  }
  if (request.body) {
    const json = jsonBody(request)
    if (json !== undefined) {
      fields.push(`body: JSON.stringify(${indentBlock(jsObject(json), 2)})`)
    } else {
      fields.push(`body: ${JSON.stringify(request.body)}`)
    }
  }
  if (fields.length === 0) {
    return undefined
  }
  return `{\n  ${fields.join(',\n  ')},\n}`
}

function toFetch(request: ExecuteRequest): string {
  const options = jsOptions(request)
  if (!options) {
    return `await fetch(${JSON.stringify(request.url)})`
  }
  return `await fetch(${JSON.stringify(request.url)}, ${options})`
}

function toAxios(request: ExecuteRequest): string {
  const json = jsonBody(request)
  const form = formBody(request)
  const data = json !== undefined ? json : (form ?? request.body)
  const headers = headerList(request)
  const fields = [
    `method: ${JSON.stringify(request.method.toLowerCase())}`,
    `url: ${JSON.stringify(request.url)}`,
  ]
  if (headers.length > 0) {
    fields.push(`headers: ${indentBlock(jsObject(Object.fromEntries(headers)), 2)}`)
  }
  if (data !== undefined) {
    fields.push(
      `data: ${typeof data === 'string' ? JSON.stringify(data) : indentBlock(jsObject(data), 2)}`,
    )
  }
  return `import axios from 'axios'\n\nawait axios({\n  ${fields.join(',\n  ')},\n})`
}

function toHttpie(request: ExecuteRequest): string {
  const lines = [`http ${request.method} ${shellSingleQuote(request.url)}`]
  for (const [name, value] of headerList(request)) {
    lines.push(`  ${shellSingleQuote(`${name}:${value}`)}`)
  }
  if (request.body) {
    const json = jsonBody(request)
    const payload = json === undefined ? request.body : prettyJson(json)
    lines.push(`  --raw ${shellSingleQuote(payload)}`)
  }
  if (lines.length === 1) {
    return lines[0] ?? 'http'
  }
  return lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \\`))
    .join('\n')
}
