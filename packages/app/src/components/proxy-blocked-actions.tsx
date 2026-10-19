import { setCloudProxy } from '../lib/cloud'
import { homepageLaunchHint, type LocalRuntime } from '../lib/runtime'
import { findCause, ProxyBlockedError } from '../lib/upstream'

export function isProxyBlocked(error: unknown) {
  return findCause(error, ProxyBlockedError) !== undefined
}

// Bot protection turns away the hosted proxy but not the user's own browser or machine,
// so offer both ways around it.
export function ProxyBlockedActions({
  onRetry,
  className = '',
  location,
  runtime,
}: {
  onRetry: () => void
  className?: string
  location?: { hostname: string; port: string; protocol: string }
  runtime?: LocalRuntime | null
}) {
  const hint = homepageLaunchHint(
    location ??
      (typeof window === 'undefined'
        ? { hostname: '', port: '', protocol: 'http:' }
        : window.location),
    runtime,
  )

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className}`}>
      <button
        type="button"
        className="inline-flex min-h-8 items-center bg-signal px-3 py-1 text-xs text-on-signal outline-none hover:opacity-90 focus-visible:opacity-90"
        onClick={() => {
          setCloudProxy(false)
          onRetry()
        }}
      >
        Use browser mode
      </button>
      {hint.kind === 'hosted' ? (
        <span className="text-mute">
          or run locally: <code className="font-mono">npx hookfish up</code>
        </span>
      ) : null}
    </div>
  )
}
