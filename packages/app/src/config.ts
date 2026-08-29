const DEFAULT_API_BASE_URL = '/api'

let apiBaseUrl = DEFAULT_API_BASE_URL

export function configureApp(options: { apiBaseUrl?: string }) {
  apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? DEFAULT_API_BASE_URL)
}

export function configuredApiBaseUrl() {
  return apiBaseUrl
}

export function configuredApiUrl(path: string) {
  const suffix = path.replace(/^\/+/, '')
  return apiBaseUrl === '/' ? `/${suffix}` : `${apiBaseUrl}/${suffix}`
}

function normalizeBaseUrl(value: string) {
  if (!value) {
    return DEFAULT_API_BASE_URL
  }
  return value === '/' ? value : value.replace(/\/+$/, '')
}
