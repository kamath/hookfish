import { createAuthClient } from 'better-auth/client'

export function createApiAuthClient(baseURL: string) {
  const url = new URL(baseURL)
  const basePath = url.pathname.replace(/\/$/, '') || '/auth'
  return createAuthClient({
    baseURL: url.origin,
    basePath: basePath === '/' ? '/auth' : basePath,
  })
}
