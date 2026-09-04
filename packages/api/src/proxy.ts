import { isHttpUrl } from './http'
import { assertMcpProxyRequest } from './mcp'

export const MCP_PROXY_AUTHORIZATION_HEADER = 'x-hookfish-mcp-authorization'

const REQUEST_HEADER_ALLOWLIST = new Set([
  'accept',
  'content-type',
  'authorization',
  'last-event-id',
])

const RESPONSE_HEADER_BLOCKLIST = new Set([
  'connection',
  'content-length',
  'set-cookie',
  'transfer-encoding',
])

const MAX_PROXY_BODY_CHARS = 2_000_000

function requestHeaders(source: Headers) {
  const headers = new Headers()
  source.forEach((value, name) => {
    const lower = name.toLowerCase()
    if (REQUEST_HEADER_ALLOWLIST.has(lower) || lower.startsWith('mcp-')) {
      headers.set(name, value)
    }
  })
  headers.delete(MCP_PROXY_AUTHORIZATION_HEADER)
  const upstreamAuthorization = source.get(MCP_PROXY_AUTHORIZATION_HEADER)
  if (upstreamAuthorization) {
    headers.set('authorization', upstreamAuthorization)
  }
  return headers
}

function filteredResponseHeaders(source: Headers) {
  const headers = new Headers()
  source.forEach((value, name) => {
    if (
      !RESPONSE_HEADER_BLOCKLIST.has(name.toLowerCase()) &&
      !name.toLowerCase().startsWith('cf-')
    ) {
      headers.set(name, value)
    }
  })
  return headers
}

export async function proxyMcpRequest(
  request: Request,
  upstreamFetch: typeof fetch = fetch,
) {
  const target = new URL(request.url).searchParams.get('url') ?? ''
  if (!isHttpUrl(target)) {
    return Response.json({ error: 'Choose an http or https MCP endpoint.' }, { status: 400 })
  }

  const method = request.method.toUpperCase()
  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    body = await request.text()
    if (body.length > MAX_PROXY_BODY_CHARS) {
      return Response.json({ error: 'The MCP request is too large.' }, { status: 400 })
    }
  }

  try {
    assertMcpProxyRequest({
      method,
      contentType: request.headers.get('content-type') ?? '',
      body,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'The request does not match the MCP protocol.'
    return Response.json({ error: message }, { status: 400 })
  }

  const headers = requestHeaders(request.headers)
  const response = await upstreamFetch(target, {
    method,
    headers,
    body,
    signal: request.signal,
    redirect: 'manual',
  })
  const responseHeaders = filteredResponseHeaders(response.headers)
  if (responseHeaders.get('content-type')?.includes('text/event-stream')) {
    responseHeaders.set('Cache-Control', 'no-cache, no-transform')
    responseHeaders.set('X-Accel-Buffering', 'no')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
