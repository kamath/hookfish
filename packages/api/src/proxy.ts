import { isHttpUrl } from './http'

const REQUEST_HEADER_BLOCKLIST = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'cookie',
  'transfer-encoding',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
])

const RESPONSE_HEADER_BLOCKLIST = new Set([
  'connection',
  'content-length',
  'set-cookie',
  'transfer-encoding',
])

function filteredHeaders(source: Headers, blocked: Set<string>) {
  const headers = new Headers()
  source.forEach((value, name) => {
    if (
      !blocked.has(name.toLowerCase()) &&
      !name.toLowerCase().startsWith('cf-') &&
      !name.toLowerCase().startsWith('sec-')
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

  const headers = filteredHeaders(request.headers, REQUEST_HEADER_BLOCKLIST)
  const response = await upstreamFetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
    signal: request.signal,
  })
  const responseHeaders = filteredHeaders(response.headers, RESPONSE_HEADER_BLOCKLIST)
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
