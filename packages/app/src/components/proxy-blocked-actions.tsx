import { setCloudProxy } from '../lib/cloud'
import { homepageLaunchHint, type LocalRuntime } from '../lib/runtime'
import { findCause, ProxyBlockedError } from '../lib/upstream'

export function isProxyBlocked(error: unknown) {
  return findCause(error, ProxyBlockedError) !== undefined
}

// Bot protection turns away the hosted proxy but not the user's own browser or machine,
// so offer both ways around it. Renders inline, to follow the error text.
export function ProxyBlockedActions({
  onRetry,
  location,
  runtime,
}: {
  onRetry: () => void
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
    <>
      {' '}
      <button
        type="button"
        className="font-medium underline underline-offset-2 outline-none hover:text-ink focus-visible:text-ink"
        onClick={(event) => {
          event.stopPropagation()
          setCloudProxy(false)
          onRetry()
        }}
      >
        Use browser mode
      </button>
      {hint.kind === 'hosted' ? (
        <>
          {' or run locally with '}
          <code className="font-mono">npx hookfish up</code>.
        </>
      ) : (
        '.'
      )}
    </>
  )
}
