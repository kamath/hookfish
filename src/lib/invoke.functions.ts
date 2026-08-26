import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { InvokeResult } from './client-types'
import { isHttpUrl } from './build-request'

const MAX_RESPONSE_CHARS = 200_000

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
      break
    }
    text += decoder.decode(value, { stream: true })
  }

  await reader.cancel()

  if (text.length > MAX_RESPONSE_CHARS) {
    return `${text.slice(0, MAX_RESPONSE_CHARS)}\n…truncated`
  }

  return text
}

export const executeRequest = createServerFn({
  method: 'POST',
})
  .validator(
    z.object({
      method: z.string().trim().min(1),
      url: z.string().trim().min(1),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<InvokeResult> => {
    if (!isHttpUrl(data.url)) {
      throw new Error('Choose an http or https URL.')
    }

    const headers = new Headers()
    for (const [name, value] of Object.entries(data.headers ?? {})) {
      headers.set(name, value)
    }

    const started = Date.now()
    const response = await fetch(data.url, {
      method: data.method.toUpperCase(),
      headers,
      body: data.body,
      signal: AbortSignal.timeout(20_000),
    })
    const elapsedMs = Date.now() - started
    const responseBody = await readLimited(response)

    return {
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()].map(([name, value]) => ({
        name,
        value,
      })),
      body: responseBody,
      elapsedMs,
      url: data.url,
      method: data.method.toUpperCase(),
    }
  })
