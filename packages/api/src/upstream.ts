import { parse as parseYaml } from 'yaml'
import { isHttpUrl } from './http'
import type { ExecuteResult, HttpRequest } from './schemas'

const MAX_RESPONSE_CHARS = 200_000
const MAX_SPEC_BYTES = 16_000_000
const MAX_UPLOAD_BYTES = 2_000_000

type UpstreamFetch = typeof fetch

function decodeBase64(data: string): ArrayBuffer {
  if (
    data.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)
  ) {
    throw new Error('The uploaded file is invalid or larger than 2 MB.')
  }

  let decoded: string
  try {
    decoded = atob(data)
  } catch {
    throw new Error('The uploaded file is not valid base64 data.')
  }
  if (decoded.length > MAX_UPLOAD_BYTES) {
    throw new Error('The uploaded file is larger than 2 MB.')
  }

  const buffer = new ArrayBuffer(decoded.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return buffer
}

function upstreamBody(request: HttpRequest, headers: Headers): BodyInit | undefined {
  if (request.body === undefined || typeof request.body === 'string') {
    return request.body
  }
  if (request.body.kind === 'binary') {
    return decodeBase64(request.body.data)
  }

  headers.delete('content-type')
  const form = new FormData()
  let totalBytes = 0
  for (const part of request.body.parts) {
    if (part.kind === 'text') {
      form.append(part.name, part.value)
      continue
    }
    const buffer = decodeBase64(part.data)
    totalBytes += buffer.byteLength
    if (totalBytes > MAX_UPLOAD_BYTES) {
      throw new Error('The uploaded files are larger than 2 MB in total.')
    }
    form.append(
      part.name,
      new Blob([buffer], { type: part.mediaType }),
      part.filename,
    )
  }
  return form
}

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
  const body = upstreamBody(request, headers)

  const started = Date.now()
  const response = await upstreamFetch(request.url, {
    method: request.method.toUpperCase(),
    headers,
    body,
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
