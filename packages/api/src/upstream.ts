import { parse as parseYaml } from 'yaml'
import { isHttpUrl } from './http'
import type { ExecuteResult, HttpRequest } from './schemas'

const MAX_RESPONSE_CHARS = 200_000
const MAX_SPEC_BYTES = 16_000_000

type UpstreamFetch = typeof fetch

async function readSpecLimited(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_SPEC_BYTES) {
    await response.body?.cancel()
    throw new Error('The spec is larger than 16 MB.')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    return new Uint8Array()
  }

  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    byteLength += value.byteLength
    if (byteLength > MAX_SPEC_BYTES) {
      await reader.cancel()
      throw new Error('The spec is larger than 16 MB.')
    }
    chunks.push(value)
  }

  const buffer = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buffer
}

async function readLimited(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_RESPONSE_CHARS * 2) {
    return `Response omitted (${contentLength} bytes).`
  }

  const reader = response.body?.getReader()
  if (!reader) {
    return ''
  }

  const decoder = new TextDecoder()
  let text = ''

  while (text.length < MAX_RESPONSE_CHARS) {
    const { done, value } = await reader.read()
    if (done) {
      text += decoder.decode()
      break
    }
    text += decoder.decode(value, { stream: true })
  }

  if (text.length >= MAX_RESPONSE_CHARS) {
    await reader.cancel()
    return `${text.slice(0, MAX_RESPONSE_CHARS)}\n…truncated`
  }

  return text
}

export async function fetchUpstreamSpec(
  specUrl: string,
  upstreamFetch: UpstreamFetch = fetch,
): Promise<unknown> {
  if (!isHttpUrl(specUrl)) {
    throw new Error('Enter an http or https OpenAPI URL.')
  }

  const response = await upstreamFetch(specUrl, {
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, text/plain',
    },
    signal: AbortSignal.timeout(15_000),
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/event-stream')) {
    await response.body?.cancel()
    throw new Error('The URL returned an event stream instead of an OpenAPI document.')
  }

  if (!response.ok) {
    throw new Error(`Could not fetch the spec (${response.status}).`)
  }

  const text = new TextDecoder().decode(await readSpecLimited(response)).trim()
  if (!text) {
    throw new Error('The spec was empty.')
  }

  try {
    if (text.startsWith('{') || text.startsWith('[')) {
      return JSON.parse(text)
    }
    return parseYaml(text)
  } catch {
    throw new Error('The response was not valid JSON or YAML.')
  }
}

export async function executeUpstreamRequest(
  request: HttpRequest,
  upstreamFetch: UpstreamFetch = fetch,
): Promise<ExecuteResult> {
  if (!isHttpUrl(request.url)) {
    throw new Error('Choose an http or https URL.')
  }

  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    headers.set(name, value)
  }

  const started = Date.now()
  const response = await upstreamFetch(request.url, {
    method: request.method.toUpperCase(),
    headers,
    body: request.body,
    signal: AbortSignal.timeout(20_000),
  })
  const elapsedMs = Date.now() - started
  const responseBody = await readLimited(response)

  return {
    status: {
      code: response.status,
      text: response.statusText,
    },
    details: {
      label: 'Headers',
      items: [...response.headers.entries()].map(([name, value]) => ({
        name,
        value,
      })),
    },
    body: responseBody,
    elapsedMs,
    target: request.url,
    action: request.method.toUpperCase(),
  }
}
