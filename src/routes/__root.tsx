import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import type { ReactNode } from 'react'
import { getSession } from '../lib/session.functions'
import appCss from '../styles.css?url'

const hotkeyDefaults = {
  hotkey: { preventDefault: true, requireReset: true },
}

export const Route = createRootRoute({
  loader: () => getSession(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { name: 'color-scheme', content: 'light' },
      { name: 'theme-color', content: '#f7f6f3' },
      { title: 'OpenAPI Client' },
      {
        name: 'description',
        content: 'Call any OpenAPI with typed fields.',
      },
    ],
    links: [
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
  component: AppShell,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function AppShell() {
  const { username } = Route.useLoaderData()

  return (
    <HotkeysProvider defaultOptions={hotkeyDefaults}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <header className="border-b border-rule bg-paper">
        <div className="flex h-12 items-center justify-between gap-4 px-3 md:px-4">
          <Link
            to="/"
            className="font-mono text-sm text-ink hover:text-signal focus-visible:border-signal"
          >
            client
          </Link>
          <p className="truncate font-mono text-xs text-mute" translate="no">
            {username}
          </p>
        </div>
      </header>
      <Outlet />
    </HotkeysProvider>
  )
}

function ErrorPage({ error }: { error: Error }) {
  return (
    <main id="main" className="px-4 py-10">
      <p className="text-sm text-signal">{error.message || 'Reload and try again.'}</p>
    </main>
  )
}

function NotFound() {
  return (
    <main id="main" className="px-4 py-10">
      <p className="text-sm text-mute">Nothing here.</p>
      <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-sm text-signal">
        Home
      </Link>
    </main>
  )
}
