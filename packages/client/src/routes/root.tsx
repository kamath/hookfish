import { type QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, useNavigate } from '@tanstack/react-router'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { useEffect, useLayoutEffect } from 'react'
import { Brand } from '../components/brand'
import { QueryStatus } from '../components/query-status'
import { ThemeToggle } from '../components/theme-toggle'
import { hydrateCloudProxy, useCloudProxy } from '../lib/cloud'
import { bindEnterMode, useGlobalKeybindings } from '../lib/keymap'
import { bindModeFromFocus } from '../lib/mode'
import { bindTheme } from '../lib/theme'

const hotkeyDefaults = {
  hotkey: { preventDefault: true },
}

export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: ClientShell,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
})

function ClientShell() {
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
          cloudProxy ? 'Turn off cloud proxy and run locally' : 'Turn on cloud proxy'
        }
        aria-pressed={cloudProxy}
        title={
          cloudProxy
            ? 'Cloud proxy on. Click to run locally.'
            : 'Local mode. Click to use the cloud proxy.'
        }
        onClick={() => setCloudProxy(!cloudProxy)}
      >
        <CloudIcon disabled={!cloudProxy} />
        <span>{cloudProxy ? 'Cloud' : 'Local'}</span>
      </button>
      <p className="min-w-0 flex-1 truncate max-md:sr-only" role="status">
        {cloudProxy ? (
          'Remote services that local mode cannot reach.'
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
      <ThemeToggle />
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
