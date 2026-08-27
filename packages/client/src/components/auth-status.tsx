import { useCallback, useEffect, useRef, useState } from 'react'
import { Kbd } from './hints'
import { keybindingsEnabled } from '../lib/keys'
import { primaryButtonClass, softButtonClass } from '../lib/ui'
import { StatusPane } from './query-status'

function authorizationHost(href: string) {
  try {
    return new URL(href).host
  } catch {
    return href
  }
}

const COUNTDOWN_START = 10

function Spinner() {
  return (
    <svg
      className="size-4 shrink-0 animate-spin text-mute"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

let finishAuthRedirect: (() => void) | undefined

export function finishPendingAuthRedirect() {
  finishAuthRedirect?.()
}

export function AuthRedirect({
  href,
  onCancel,
  name,
}: {
  href: string
  onCancel: () => void
  name?: string
}) {
  const [remaining, setRemaining] = useState(COUNTDOWN_START)
  const onCancelRef = useRef(onCancel)
  const remainingRef = useRef(remaining)
  onCancelRef.current = onCancel
  remainingRef.current = remaining

  const goNow = useCallback(() => {
    setRemaining(0)
  }, [])
  finishAuthRedirect = goNow

  useEffect(() => {
    finishAuthRedirect = goNow
    return () => {
      if (finishAuthRedirect === goNow) {
        finishAuthRedirect = undefined
      }
    }
  }, [goNow])

  useEffect(() => {
    if (remaining === 0) {
      window.location.assign(href)
      return
    }
    const timer = window.setTimeout(() => {
      setRemaining((value) => value - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [href, remaining])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!keybindingsEnabled()) {
        return
      }
      const waiting = remainingRef.current > 0
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (waiting) {
          onCancelRef.current()
        }
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (waiting && !event.metaKey && !event.ctrlKey && !event.altKey) {
          goNow()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [goNow])

  return (
    <AuthRedirectView
      href={href}
      name={name}
      remaining={remaining}
      onGoNow={goNow}
      onCancel={onCancel}
    />
  )
}

export function AuthRedirectView({
  href,
  name,
  remaining,
  onGoNow,
  onCancel,
}: {
  href: string
  name?: string
  remaining: number
  onGoNow: () => void
  onCancel: () => void
}) {
  const host = authorizationHost(href)
  const waiting = remaining > 0

  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className="max-w-xl text-sm text-ink">
        {name ? `Sign in to ${name} to continue.` : 'This MCP server needs you to sign in.'}
      </p>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-mute">
        <Spinner />
        <span>
          Sending you to <span className="text-ink" title={href}>{host}</span>
          {waiting ? (
            <>
              {' '}
              in <span className="font-mono text-ink">{remaining}</span>
            </>
          ) : (
            <>
              {' '}
              <span className="text-ink">now</span>
            </>
          )}
        </span>
      </p>
      {waiting ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" className={primaryButtonClass} onClick={onGoNow}>
            Go now
            <Kbd hotkey="Enter" persistent />
          </button>
          <button type="button" className={softButtonClass} onClick={onCancel}>
            Cancel
            <Kbd hotkey="Escape" persistent />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function AuthCallback() {
  return (
    <StatusPane>
      <p className="text-sm text-mute">Completing authentication…</p>
    </StatusPane>
  )
}
