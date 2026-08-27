import { type QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { type ReactNode, useEffect, useLayoutEffect } from 'react'
import { Brand } from '../components/brand'
import { GitHubLink } from '../components/github-link'
import { QueryStatus } from '../components/query-status'
import { ThemeToggle } from '../components/theme-toggle'
import { hydrateCloudProxy, useCloudProxy } from '../lib/cloud'
import { bindEnterMode, useGlobalKeybindings } from '../lib/keymap'
import { bindModeFromFocus } from '../lib/mode'
import { THEME_COLORS, THEME_INIT_SCRIPT, bindTheme } from '../lib/theme'
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
  component: AppShell,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
  useLayoutEffect(() => bindTheme(), [])

  useEffect(() => {
    hydrateCloudProxy()
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
        <CloudProxyToggle />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </HotkeysProvider>
  )
}

function CloudIcon({ disabled }: { disabled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.7 4.7 4.7 0 0 0 7 18Z" />
      {disabled ? <path d="m4 4 16 16" /> : null}
    </svg>
  )
}

function CloudProxyToggle() {
  const [cloudProxy, setCloudProxy] = useCloudProxy()
  return (
    <div className="flex shrink-0 items-center gap-2 bg-ink/5 px-3 py-1.5 text-xs text-mute md:gap-3 md:px-4">
      <button
        type="button"
        className="inline-flex min-h-8 shrink-0 items-center gap-2 bg-ink/10 px-2.5 py-1 font-medium text-ink outline-none hover:bg-ink/15 focus-visible:bg-ink/15"
        aria-label={
          cloudProxy
            ? 'Run browser-first'
            : 'Turn on cloud proxy'
        }
        aria-pressed={cloudProxy}
        title={
          cloudProxy
            ? 'Hookfish is reaching remote hosts for you. Click to run browser-first.'
            : 'Local mode. Click to use the cloud proxy.'
        }
        onClick={() => setCloudProxy(!cloudProxy)}
      >
        <CloudIcon disabled={!cloudProxy} />
        <span>{cloudProxy ? 'Cloud' : 'Local'}</span>
      </button>
      <p className="min-w-0 flex-1 truncate max-md:sr-only" role="status">
        {cloudProxy ? (
          'Hookfish is reaching remote hosts for you. Click to run browser-first.'
        ) : (
          <>
            This computer. Remote hosts may block the browser (
            <a
              href="https://www.google.com/search?q=what+is+cors"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-signal underline underline-offset-2"
            >
              CORS
            </a>
            ).
          </>
        )}
      </p>
      <div className="ml-auto flex shrink-0 items-center">
        <GitHubLink />
        <ThemeToggle />
      </div>
    </div>
  )
}

function GlobalKeybindings() {
  useGlobalKeybindings()
  return null
}

function ErrorPage({ error }: { error: Error }) {
  const navigate = useNavigate()
  return (
    <QueryStatus
      error={error}
      onRetry={() => window.location.reload()}
      onBack={() => {
        void navigate({ to: '/' })
      }}
    />
  )
}

function NotFound() {
  const navigate = useNavigate()
  return (
    <QueryStatus
      label="Nothing here."
      onBack={() => {
        void navigate({ to: '/' })
      }}
    >
      <div className="mt-4">
        <Brand />
      </div>
    </QueryStatus>
  )
}
