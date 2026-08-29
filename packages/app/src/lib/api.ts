import { hc } from 'hono/client'
import type { AppType } from '@hookfish/api'
import { isOwnOpenApiUrl as isOwnApiOpenApiUrl } from '@hookfish/api'
import { configuredApiBaseUrl } from '../config'

export const API_BASE_URL = '/api'

export function getApiBaseUrl(origin?: string) {
  const baseUrl = configuredApiBaseUrl()
  const resolved =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  if (!resolved) {
    return baseUrl
  }
  return new URL(baseUrl, resolved).toString().replace(/\/$/, '')
}

export function getApi(origin?: string) {
  return hc<AppType>(getApiBaseUrl(origin), {
    init: { credentials: 'include' },
  })
}

export function isOwnOpenApiUrl(sourceUrl: string, origin?: string) {
  const resolved =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  return isOwnApiOpenApiUrl(sourceUrl, `${getApiBaseUrl(resolved)}/spec`)
}

export async function apiJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.headers.get('cf-mitigated') === 'challenge') {
      throw new Error('A security check blocked this request. Reload the page and try again.')
    }
    throw new Error(
      response.ok ? 'The server returned an invalid response.' : `Request failed (${response.status})`,
    )
  }
  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error
        ? body.error
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  return body as T
}
