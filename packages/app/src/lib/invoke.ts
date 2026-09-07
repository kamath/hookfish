import type { ExecuteRequest } from '@hookfish/api'
import type { AuthScheme, ClientOperation, HttpBinding } from './client-types'
import { asRecord, buildRequestUrl, isHttpUrl, omitEmpty } from './build-request'
import { parseFileDataUrl } from './file-data'
import { applyAuth } from './openapi'

export type { ExecuteRequest }

const BODY_METHODS = new Set(['post', 'put', 'patch', 'delete'])
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  for (const name of new Set(headers.keys())) {
    const value = headers.get(name)
    if (value) {
      record[name] = value
    }
  }
  return record
}

export function httpBindingFor(operation: ClientOperation): HttpBinding {
  const binding = operation.binding
  if (
    binding.type !== 'http' ||
    typeof binding.method !== 'string' ||
    !HTTP_METHODS.has(binding.method) ||
    typeof binding.path !== 'string' ||
    (binding.contentType !== undefined && typeof binding.contentType !== 'string') ||
    (binding.bodyEncoding !== undefined &&
      (typeof binding.bodyEncoding !== 'string' ||
        !['json', 'urlencoded', 'binary', 'multipart'].includes(binding.bodyEncoding)))
  ) {
    throw new Error('The executable does not have a valid HTTP binding.')
  }
  return binding as HttpBinding
}

function multipartBody(
  formBody: unknown,
  operation: ClientOperation,
): NonNullable<ExecuteRequest['body']> {
  const parts: Array<
    | { kind: 'text'; name: string; value: string }
    | {
        kind: 'file'
        name: string
        data: string
        filename: string
        mediaType: string
      }
  > = []

  function append(name: string, item: unknown) {
    if (Array.isArray(item)) {
      for (const child of item) {
        append(name, child)
      }
      return
    }
    if (item === undefined || item === null) {
      return
    }
    const file = parseFileDataUrl(item)
    if (file) {
      const property = asRecord(
        asRecord(asRecord(operation.inputSchema.properties).body).properties,
      )[name]
      const declaredMediaType = asRecord(property).contentMediaType
      const mediaType =
        typeof declaredMediaType === 'string' &&
        !declaredMediaType.includes(',') &&
        !declaredMediaType.includes('*')
          ? declaredMediaType
          : file.mediaType
      parts.push({ kind: 'file', name, ...file, mediaType })
      return
    }
    parts.push({
      kind: 'text',
      name,
      value: typeof item === 'object' ? JSON.stringify(item) : String(item),
    })
  }

  for (const [name, value] of Object.entries(asRecord(formBody))) {
    append(name, value)
  }
  return { kind: 'multipart', parts }
}

export function buildOperationRequest(input: {
  specUrl: string
  serverUrl: string
  operation: ClientOperation
  formData: unknown
  auth: Record<string, string>
  authSchemes: AuthScheme[]
}): ExecuteRequest {
  if (!isHttpUrl(input.serverUrl)) {
    throw new Error('Choose an http or https server URL.')
  }

  const binding = httpBindingFor(input.operation)
  const form = asRecord(input.formData)
  const path = asRecord(omitEmpty(form.path))
  const query = asRecord(omitEmpty(form.query))
  const header = asRecord(omitEmpty(form.header))
  const cookie = asRecord(omitEmpty(form.cookie))
  const url = new URL(
    buildRequestUrl(input.serverUrl, binding.path, path, query),
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

  applyAuth(headers, url, input.authSchemes, input.auth)

  let body: ExecuteRequest['body']
  if (BODY_METHODS.has(binding.method) && form.body !== undefined) {
    const contentType = binding.contentType ?? 'application/json'
    const encoding = binding.bodyEncoding ?? 'json'
    if (encoding === 'multipart') {
      headers.delete('Content-Type')
    } else if (!headers.has('Content-Type')) {
      headers.set('Content-Type', contentType)
    }

    if (encoding === 'urlencoded') {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(asRecord(form.body))) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value))
        }
      }
      body = params.toString()
    } else if (encoding === 'binary') {
      const file = parseFileDataUrl(form.body)
      if (!file) {
        throw new Error('Choose a file to upload.')
      }
      body = { kind: 'binary', data: file.data }
    } else if (encoding === 'multipart') {
      body = multipartBody(form.body, input.operation)
    } else {
      body = JSON.stringify(form.body)
    }
  }

  return {
    specUrl: input.specUrl,
    transport: 'http',
    method: binding.method.toUpperCase(),
    url: url.toString(),
    headers: headersToRecord(headers),
    body,
  }
}
