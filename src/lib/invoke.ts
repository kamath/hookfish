import type { AuthScheme, ClientOperation, HttpBinding } from './client-types'
import { asRecord, buildRequestUrl, isHttpUrl, omitEmpty } from './build-request'
import { applyAuth } from './openapi'

const BODY_METHODS = new Set(['post', 'put', 'patch', 'delete'])
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

export type ExecuteRequest = {
  transport: 'http'
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

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
    (binding.contentType !== undefined && typeof binding.contentType !== 'string')
  ) {
    throw new Error('The executable does not have a valid HTTP binding.')
  }
  return binding as HttpBinding
}

export function buildOperationRequest(input: {
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

  let body: string | undefined
  if (BODY_METHODS.has(binding.method) && form.body !== undefined) {
    const contentType = binding.contentType ?? 'application/json'
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

  return {
    transport: 'http',
    method: binding.method.toUpperCase(),
    url: url.toString(),
    headers: headersToRecord(headers),
    body,
  }
}
