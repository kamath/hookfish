import {
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import {
  contentSecurityPolicy,
  mountApp,
  THEME_COLORS,
  THEME_INIT_SCRIPT,
} from '@hookfish/app'
import appCss from '@hookfish/app/styles.css?url'
import { type ReactNode, useEffect, useRef } from 'react'

export const Route = createRootRoute({
  // Only rendered pages carry the policy; API responses set their own headers.
  headers: ({ ssr }) =>
    ssr?.nonce
      ? { 'Content-Security-Policy': contentSecurityPolicy(ssr.nonce) }
      : undefined,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { name: 'color-scheme', content: 'light dark' },
      { name: 'theme-color', content: THEME_COLORS.light },
      { title: 'Hookfish' },
      {
        name: 'description',
        content: 'Browse, configure, and run executables from pluggable sources.',
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: ClientAppHost,
  notFoundComponent: () => null,
})

function ClientAppHost() {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) {
      return
    }
    return mountApp(element, { apiBaseUrl: '/api' })
  }, [])

  return (
    <>
      <div ref={elementRef} className="h-dvh" />
      <Outlet />
    </>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ScriptOnce>{THEME_INIT_SCRIPT}</ScriptOnce>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
