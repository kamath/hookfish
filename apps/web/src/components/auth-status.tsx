import { useEffect, useRef, useState } from 'react'
import { Kbd } from './hints'
import { primaryButtonClass, softButtonClass } from '../lib/ui'

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
  onCancelRef.current = onCancel

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
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        onCancelRef.current()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          window.location.assign(href)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [href])

  const host = authorizationHost(href)

  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className="max-w-xl text-sm text-ink">
        {name ? `Sign in to ${name} to continue.` : 'This MCP server needs you to sign in.'}
      </p>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-mute">
        <Spinner />
        <span>
          Sending you to <span className="text-ink" title={href}>{host}</span>
          {remaining > 0 ? (
            <>
              {' '}
              in <span className="font-mono text-ink">{remaining}</span>
            </>
          ) : null}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            window.location.assign(href)
          }}
        >
          Go now
          <Kbd hotkey="Enter" persistent />
        </button>
        <button type="button" className={softButtonClass} onClick={onCancel}>
          Cancel
          <Kbd hotkey="Escape" persistent />
        </button>
      </div>
    </div>
  )
}

export function AuthCallback() {
  return (
    <main id="main" className="flex h-full items-center justify-center px-4">
      <p className="text-sm text-mute">Completing authentication…</p>
    </main>
  )
}
