import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { mountApp, THEME_COLORS, THEME_INIT_SCRIPT } from '@hookfish/app'
import appCss from '@hookfish/app/styles.css?url'
import { type ReactNode, useEffect, useRef } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { name: 'color-scheme', content: 'light dark' },
      { name: 'theme-color', content: THEME_COLORS.light },
      { title: 'Smithery' },
      {
        name: 'description',
        content: 'Browse, configure, and run executables from pluggable sources.',
      },
      { property: 'og:title', content: 'Smithery' },
      {
        property: 'og:description',
        content: 'Browse, configure, and run executables from pluggable sources.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/og-image.png' },
      { property: 'og:image:width', content: '2400' },
      { property: 'og:image:height', content: '1260' },
      { property: 'og:image:alt', content: 'Smithery' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Smithery' },
      {
        name: 'twitter:description',
        content: 'Browse, configure, and run executables from pluggable sources.',
      },
      { name: 'twitter:image', content: '/og-image.png' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/og-image-square.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;700&display=swap',
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
