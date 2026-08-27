import { useEffect, useRef, useState } from 'react'
import { QueryStatus } from './query-status'

const COUNTDOWN_START = 3

export function AuthRedirect({ href }: { href: string }) {
  const [remaining, setRemaining] = useState(COUNTDOWN_START)
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    linkRef.current?.focus()
  }, [])

  useEffect(() => {
    if (remaining <= 1) {
      return
    }
    const timer = window.setTimeout(() => {
      setRemaining((value) => value - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  return (
    <main id="main" className="px-4 py-10">
      <p className="text-sm text-mute">
        Redirecting in{' '}
        <span className="font-mono">
          {[3, 2, 1].map((value, index) => (
            <span
              key={value}
              className={value === remaining ? 'text-ink' : 'text-faint'}
            >
              {index > 0 ? ' ' : ''}
              {value}
            </span>
          ))}
        </span>
      </p>
      <a
        ref={linkRef}
        href={href}
        className="mt-4 inline-flex min-h-11 items-center text-sm text-signal"
      >
        Continue automatically
      </a>
    </main>
  )
}

export function AuthCallback() {
  return <QueryStatus label="Completing authentication…" />
}
