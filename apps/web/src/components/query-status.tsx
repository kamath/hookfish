import { queryErrorMessage } from '../lib/queries'

export function QueryMessage({
  label,
  error,
  onRetry,
}: {
  label?: string
  error?: unknown
  onRetry?: () => void
}) {
  const failed = error !== undefined && error !== null
  return (
    <div>
      <p
        className={`text-sm ${failed ? 'text-signal' : 'text-mute'}`}
        role={failed ? 'alert' : undefined}
      >
        {failed ? queryErrorMessage(error, 'Could not load.') : label}
      </p>
      {failed && onRetry ? (
        <button
          type="button"
          className="mt-3 text-sm text-signal hover:text-ink"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function QueryStatus({
  label,
  error,
  onRetry,
}: {
  label?: string
  error?: unknown
  onRetry?: () => void
}) {
  return (
    <main id="main" className="px-4 py-10">
      <QueryMessage label={label} error={error} onRetry={onRetry} />
    </main>
  )
}
