import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'
import type { InvokeResult } from './client-types'
import { asRecord, buildRequestUrl, isHttpUrl, omitEmpty } from './build-request'
import { getDb } from './db.server'
import { readApiAuth } from './auth.server'
import { applyAuth, fetchSpec, findOperation } from './openapi.server'
import { ensureUser } from './session.server'

const MAX_RESPONSE_CHARS = 200_000

const BODY_METHODS = new Set(['post', 'put', 'patch', 'delete'])

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

export const invokeOperation = createServerFn({
  method: 'POST',
  strict: { input: false },
})
  .validator(
    z.object({
      apiId: z.string(),
      operationId: z.string(),
      serverUrl: z.string().trim(),
      formData: z.unknown(),
    }),
  )
  .handler(async ({ data }): Promise<InvokeResult> => {
    if (!isHttpUrl(data.serverUrl)) {
      throw new Error('Choose an http or https server URL.')
    }

    const username = await ensureUser()
    const db = await getDb()
    const row = await db
      .prepare(
        'SELECT spec_url FROM apis WHERE id = ? AND username = ?',
      )
      .bind(data.apiId, username)
      .first<{ spec_url: string }>()

    if (!row) {
      throw notFound()
    }

    const spec = await fetchSpec(row.spec_url)
    const operation = findOperation(spec, row.spec_url, data.operationId)
    const form = asRecord(data.formData)
    const path = asRecord(omitEmpty(form.path))
    const query = asRecord(omitEmpty(form.query))
    const header = asRecord(omitEmpty(form.header))
    const cookie = asRecord(omitEmpty(form.cookie))
    const auth = await readApiAuth(data.apiId)
    const url = new URL(
      buildRequestUrl(data.serverUrl, operation.path, path, query),
    )
    const headers = new Headers()

    for (const [name, value] of Object.entries(header)) {
      headers.set(name, String(value))
    }

    const cookieHeader = Object.entries(cookie)
      .map(([name, value]) => `${name}=${String(value)}`)
      .join('; ')
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }

    applyAuth(headers, url, spec, auth)

    let body: string | undefined
    if (BODY_METHODS.has(operation.method) && form.body !== undefined) {
      const contentType = operation.contentType ?? 'application/json'
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', contentType)
      }

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(asRecord(form.body))) {
          if (value !== undefined && value !== null) {
            params.set(key, String(value))
          }
        }
        body = params.toString()
      } else {
        body = JSON.stringify(form.body)
      }
    }

    const started = Date.now()
    const response = await fetch(url.toString(), {
      method: operation.method.toUpperCase(),
      headers,
      body,
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
      url: url.toString(),
      method: operation.method.toUpperCase(),
    }
  })
