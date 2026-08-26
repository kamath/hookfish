import type { ApiSummary } from './client-types'

export const DEFAULTS_VERSION = 1

export const ARCADE_SPEC_URL = 'https://api.arcade.dev/v1/swagger'
export const PETSTORE_SPEC_URL = 'https://petstore3.swagger.io/api/v3/openapi.json'

export const DEFAULT_SPECS: readonly ApiSummary[] = [
  {
    id: 'default-arcade',
    kind: 'openapi',
    title: 'Arcade API',
    version: '0.1.0',
    sourceUrl: ARCADE_SPEC_URL,
    executableCount: 59,
    createdAt: '2026-08-26T00:00:00.000Z',
  },
  {
    id: 'default-petstore',
    kind: 'openapi',
    title: 'Swagger Petstore',
    version: '1.0.27',
    sourceUrl: PETSTORE_SPEC_URL,
    executableCount: 19,
    createdAt: '2026-08-26T00:00:00.000Z',
  },
]

export function specUrlKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    const path =
      parsed.pathname.endsWith('/') && parsed.pathname !== '/'
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname
    return `${parsed.origin}${path}`.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

export function mergeDefaultSpecs(
  apis: ApiSummary[],
  seededVersion: number,
): { apis: ApiSummary[]; persist: boolean } {
  if (seededVersion >= DEFAULTS_VERSION) {
    return { apis, persist: false }
  }

  const have = new Set(apis.map((api) => specUrlKey(api.sourceUrl)))
  const additions = DEFAULT_SPECS.filter((spec) => !have.has(specUrlKey(spec.sourceUrl)))
  return {
    apis: additions.length > 0 ? [...additions, ...apis] : apis,
    persist: true,
  }
}
