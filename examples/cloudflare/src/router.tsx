import { createCspNonce } from '@hookfish/app'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'

// Each server render gets its own nonce. The router stamps it on every script it emits, and
// the root route sends the matching Content-Security-Policy with the page. Dev skips it: the
// devtools inject scripts of their own that carry no nonce.
const cspNonce = createIsomorphicFn()
  .server(() => (import.meta.env.PROD ? createCspNonce() : undefined))
  .client(() => undefined)

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    ssr: { nonce: cspNonce() },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
