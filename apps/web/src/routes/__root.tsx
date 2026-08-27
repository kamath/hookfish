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
import { CloudToggle } from '../components/cloud-toggle'
import { GitHubLink } from '../components/github-link'
import { Kbd } from '../components/hints'
import { BackCaret } from '../components/pane-back-button'
import { QueryStatus } from '../components/query-status'
import { ThemeToggle } from '../components/theme-toggle'
import { hydrateCloudProxy } from '../lib/cloud'
import { bindEnterMode, useGlobalKeybindings } from '../lib/keymap'
import { bindModeFromFocus } from '../lib/mode'
import { THEME_COLORS, THEME_INIT_SCRIPT, bindTheme } from '../lib/theme'
import { useSourceToolbarValue } from '../lib/toolbar'
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
            triggerMode: 'fixed',
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
        <AppToolbar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </HotkeysProvider>
  )
}

function AppToolbar() {
  const source = useSourceToolbarValue()

  return (
    <div className="flex shrink-0 items-center gap-2 px-3 py-1.5 md:gap-3 md:px-4">
      {source ? (
        <>
          <Brand compact />
          <span className="min-w-0 truncate text-sm text-ink">{source.title}</span>
          {source.onClearAuth ? (
            <button
              type="button"
              className="oc-bar-action inline-flex shrink-0 items-center justify-center gap-2 text-sm leading-4 text-mute hover:text-ink disabled:opacity-40"
              aria-label="Clear auth"
              disabled={source.authPending}
              onClick={() => {
                void source.onClearAuth?.()
              }}
            >
              <span className="oc-bar-action-label">Clear auth</span>
              <span className="oc-bar-action-icon" aria-hidden="true">
                <TrashIcon />
              </span>
              <Kbd hotkey="Mod+Backspace" />
            </button>
          ) : null}
        </>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center">
        {source?.onBack ? (
          <button
            type="button"
            className="oc-chrome-back oc-bar-action inline-flex shrink-0 items-center justify-center text-sm leading-4 text-mute hover:text-ink"
            aria-label={source.backLabel}
            onClick={source.onBack}
          >
            <BackCaret />
            <Kbd hotkey="Escape" />
          </button>
        ) : null}
        <CloudToggle />
        <GitHubLink />
        <ThemeToggle />
      </div>
    </div>
  )
}

function TrashIcon() {
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
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
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
