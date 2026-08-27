import { parse as parseYaml } from 'yaml'
import type { InvokeResult } from './client-types'
import { isHttpUrl } from './build-request'
import type { ExecuteRequest } from './invoke'

const MAX_RESPONSE_CHARS = 200_000
const MAX_SPEC_BYTES = 16_000_000

type UpstreamFetch = typeof fetch

export async function localUpstreamFetch(
  input: string | URL | Request,
  init?: RequestInit,
  upstreamFetch: UpstreamFetch = fetch,
) {
  try {
    return await upstreamFetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'This request may be blocked by CORS. Turn off local mode and try again.',
        { cause: error },
      )
    }
    throw error
  }
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
      Accept: 'application/json, application/yaml, text/yaml, text/plain, */*',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Could not fetch the spec (${response.status}).`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_SPEC_BYTES) {
    throw new Error('The spec is larger than 16 MB.')
  }

  const text = new TextDecoder().decode(buffer).trim()
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
  request: ExecuteRequest,
  upstreamFetch: UpstreamFetch = fetch,
): Promise<InvokeResult> {
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
