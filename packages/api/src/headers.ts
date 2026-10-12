// Custom request headers a user attaches to a source, e.g. `X-API-Key` or a static
// `Authorization` bearer token. They travel from the browser to the MCP proxy as JSON in a
// private carrier header because the proxy otherwise forwards only an allowlist.
export const MCP_PROXY_HEADERS_HEADER = 'x-hookfish-mcp-headers'

const MAX_CUSTOM_HEADERS_CHARS = 8_000
const MAX_CUSTOM_HEADERS = 32

const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

// Names a user cannot set: the transport, the browser, or the proxy owns them.
const FORBIDDEN_HEADERS = new Set([
  'connection',
  'content-length',
  'content-type',
  'cookie',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'proxy-authorization',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

export function isHeaderName(name: string) {
  return TOKEN.test(name)
}

export function isAllowedCustomHeader(name: string) {
  const lower = name.toLowerCase()
  return (
    isHeaderName(name) &&
    !FORBIDDEN_HEADERS.has(lower) &&
    !lower.startsWith('x-hookfish-') &&
    !lower.startsWith('proxy-') &&
    !lower.startsWith('sec-') &&
    !lower.startsWith('mcp-')
  )
}

function isHeaderValue(value: string) {
  return !/[\r\n\0]/.test(value)
}

export function encodeCustomHeaders(headers: Record<string, string>) {
  return JSON.stringify(headers)
}

// Returns only well-formed, allowed headers. Anything malformed is dropped rather than
// rejected so a stale or tampered carrier cannot break the MCP request itself.
export function decodeCustomHeaders(raw: string | null | undefined) {
  const headers: Record<string, string> = {}
  if (!raw || raw.length > MAX_CUSTOM_HEADERS_CHARS) {
    return headers
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return headers
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return headers
  }
  for (const [name, value] of Object.entries(parsed).slice(0, MAX_CUSTOM_HEADERS)) {
    if (typeof value === 'string' && isAllowedCustomHeader(name) && isHeaderValue(value)) {
      headers[name] = value
    }
  }
  return headers
}

export type ParsedHeaders =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string }

// Parses one `Name: value` pair per line. Blank lines are ignored.
export function parseHeaderLines(text: string): ParsedHeaders {
  const headers: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue
    }
    const separator = line.indexOf(':')
    const name = (separator === -1 ? line : line.slice(0, separator)).trim()
    const value = separator === -1 ? '' : line.slice(separator + 1).trim()
    const lineLabel = `Line ${index + 1}`
    if (separator === -1) {
      return { ok: false, error: `${lineLabel}: use "Name: value".` }
    }
    if (!isHeaderName(name)) {
      return { ok: false, error: `${lineLabel}: "${name}" is not a valid header name.` }
    }
    if (!isAllowedCustomHeader(name)) {
      return { ok: false, error: `${lineLabel}: ${name} cannot be set.` }
    }
    headers[name] = value
  }
  if (Object.keys(headers).length > MAX_CUSTOM_HEADERS) {
    return { ok: false, error: `Use at most ${MAX_CUSTOM_HEADERS} headers.` }
  }
  if (encodeCustomHeaders(headers).length > MAX_CUSTOM_HEADERS_CHARS) {
    return { ok: false, error: 'Those headers are too long.' }
  }
  return { ok: true, headers }
}
