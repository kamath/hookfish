import { type QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { type ReactNode, useEffect } from 'react'
import { bindEnterMode, useGlobalKeybindings } from '../lib/keymap'
import { bindModeFromFocus } from '../lib/mode'
import appCss from '../styles.css?url'

const hotkeyDefaults = {
  hotkey: { preventDefault: true },
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { name: 'color-scheme', content: 'light' },
      { name: 'theme-color', content: '#f7f6f3' },
      { title: 'Executable Client' },
      {
        name: 'description',
        content: 'Browse, configure, and run executables from pluggable sources.',
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
  useEffect(() => {
    const unbindFocus = bindModeFromFocus()
    const unbindEnter = bindEnterMode()
    return () => {
      unbindFocus()
      unbindEnter()
    }
  }, [])

  return (
    <HotkeysProvider defaultOptions={hotkeyDefaults}>
      <GlobalKeybindings />
      <div className="flex h-dvh flex-col overflow-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <header className="shrink-0 border-b border-rule bg-paper">
          <div className="flex h-12 items-center px-3 md:px-4">
            <Link
              to="/"
              className="font-mono text-sm text-ink hover:text-signal focus-visible:border-signal"
            >
              client
            </Link>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </HotkeysProvider>
  )
}

function GlobalKeybindings() {
  useGlobalKeybindings()
  return null
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
