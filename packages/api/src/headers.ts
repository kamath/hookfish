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

export type HeaderEntry = { name: string; value: string }

export type ParsedHeaders =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string }

function unquote(value: string) {
  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
    return value.slice(1, -1)
  }
  return value
}

function jsonEntries(text: string): HeaderEntry[] | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined
  }
  const entries: HeaderEntry[] = []
  for (const [name, value] of Object.entries(parsed)) {
    if (typeof value === 'object' && value !== null) {
      return undefined
    }
    entries.push({ name, value: value === null ? '' : String(value) })
  }
  return entries
}

// Reads pasted headers as a JSON object, `.env` lines (`NAME=value`, optional `export`,
// quotes, `#` comments), or `Name: value` lines. The earlier of `=` and `:` splits a line,
// so `Authorization: Bearer a=b` and `TOKEN=a:b` both read as intended. Returns undefined
// when the text is not in one of those shapes, so callers can treat it as a plain value.
export function parseHeaderText(text: string): HeaderEntry[] | undefined {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return jsonEntries(trimmed)
  }
  const entries: HeaderEntry[] = []
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const body = line.replace(/^export\s+/, '')
    const separators = [body.indexOf('='), body.indexOf(':')].filter((index) => index > 0)
    if (separators.length === 0) {
      return undefined
    }
    const separator = Math.min(...separators)
    entries.push({
      name: body.slice(0, separator).trim(),
      value: unquote(body.slice(separator + 1).trim()),
    })
  }
  return entries.length > 0 ? entries : undefined
}

// Validates header rows. Rows with neither a name nor a value are ignored.
export function validateHeaderEntries(entries: HeaderEntry[]): ParsedHeaders {
  const headers: Record<string, string> = {}
  for (const entry of entries) {
    const name = entry.name.trim()
    const value = entry.value.trim()
    if (!name && !value) {
      continue
    }
    if (!name) {
      return { ok: false, error: 'Each header value needs a name.' }
    }
    if (!isHeaderName(name)) {
      return { ok: false, error: `"${name}" is not a valid header name.` }
    }
    if (!isAllowedCustomHeader(name)) {
      return { ok: false, error: `${name} cannot be set.` }
    }
    if (!isHeaderValue(value)) {
      return { ok: false, error: `${name} has a line break in its value.` }
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
