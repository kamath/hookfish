import { createAuthClient } from 'better-auth/client'
import { jwtClient } from 'better-auth/client/plugins'

export function createApiAuthClient(baseURL: string) {
  const url = new URL(baseURL)
  const basePath = url.pathname.replace(/\/$/, '') || '/auth'
  return createAuthClient({
    baseURL: url.origin,
    basePath: basePath === '/' ? '/auth' : basePath,
    plugins: [jwtClient()],
  })
}
