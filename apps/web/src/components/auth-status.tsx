import { useEffect, useRef, useState } from 'react'
import { Kbd } from './hints'
import { QueryStatus } from './query-status'
import { primaryButtonClass, softButtonClass } from '../lib/ui'

const COUNTDOWN_START = 3

export function AuthRedirect({
  href,
  onCancel,
}: {
  href: string
  onCancel: () => void
}) {
  const [remaining, setRemaining] = useState(COUNTDOWN_START)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (remaining <= 1) {
      return
    }
    const timer = window.setTimeout(() => {
      setRemaining((value) => value - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onCancelRef.current()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.location.assign(href)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [href])

  return (
    <div>
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
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            window.location.assign(href)
          }}
        >
          Continue
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
  return <QueryStatus label="Completing authentication…" />
}
