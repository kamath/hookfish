import { hc } from 'hono/client'
import type { AppType } from '@hookfish/api'
import { isOwnOpenApiUrl as isOwnApiOpenApiUrl } from '@hookfish/api'

export const DEFAULT_API_BASE_URL = '/api'

let apiBaseUrl = DEFAULT_API_BASE_URL

export function configureApiBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, '')
  if (!normalized) {
    throw new Error('apiBaseUrl must not be empty')
  }
  apiBaseUrl = normalized
}

export function getConfiguredApiBaseUrl() {
  return apiBaseUrl
}

export function getApiBaseUrl(origin?: string) {
  const resolved =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  if (!resolved) {
    return apiBaseUrl
  }
  return new URL(apiBaseUrl, resolved).toString().replace(/\/$/, '')
}

export function getApi(origin?: string) {
  return hc<AppType>(getApiBaseUrl(origin))
}

export function isOwnOpenApiUrl(sourceUrl: string, origin?: string) {
  const resolved =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  const specUrl = new URL(`${getApiBaseUrl(resolved)}/spec`).toString()
  return isOwnApiOpenApiUrl(sourceUrl, specUrl)
}

export async function apiJson<T>(response: Response): Promise<T> {
  const body = await response.json()
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
