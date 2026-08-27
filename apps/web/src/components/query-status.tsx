import { useEffect, useRef, type ReactNode } from 'react'
import { queryErrorMessage } from '../lib/queries'
import { primaryButtonClass, softButtonClass } from '../lib/ui'
import { Kbd } from './hints'

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
        className={`text-sm ${failed ? 'text-error' : 'text-mute'}`}
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
  onBack,
  children,
}: {
  label?: string
  error?: unknown
  onRetry?: () => void
  onBack?: () => void
  children?: ReactNode
}) {
  const failed = error !== undefined && error !== null
  const onRetryRef = useRef(onRetry)
  const onBackRef = useRef(onBack)
  onRetryRef.current = onRetry
  onBackRef.current = onBack

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onBackRef.current) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        onBackRef.current()
        return
      }
      if (
        event.key === 'Enter' &&
        onRetryRef.current &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        onRetryRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <main id="main" className="flex h-full items-center justify-center px-4">
      <div className="flex w-full flex-col items-center text-center">
        <p
          className={`max-w-xl text-sm ${failed ? 'text-error' : 'text-mute'}`}
          role={failed ? 'alert' : undefined}
        >
          {failed ? queryErrorMessage(error, 'Could not load.') : label}
        </p>
        {failed || onBack ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {failed && onRetry ? (
              <button type="button" className={primaryButtonClass} onClick={onRetry}>
                Try again
                <Kbd hotkey="Enter" persistent />
              </button>
            ) : null}
            {onBack ? (
              <button type="button" className={softButtonClass} onClick={onBack}>
                Back
                <Kbd hotkey="Escape" persistent />
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  )
}
