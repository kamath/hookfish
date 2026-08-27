import { useEffect, useState, type ReactNode } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import { useKeybindingsEnabled } from '../lib/keymap'

export function Kbd({
  hotkey,
  persistent,
  fallback,
}: {
  hotkey: RegisterableHotkey | string
  persistent?: boolean
  fallback?: ReactNode
}) {
  const enabled = useKeybindingsEnabled()
  const [label, setLabel] = useState(() =>
    typeof hotkey === 'string' ? hotkey : '',
  )
  const className = persistent ? undefined : 'oc-key-hint'

  useEffect(() => {
    setLabel(formatForDisplay(hotkey))
  }, [hotkey])

  if (!enabled) {
    return fallback != null ? (
      <span className="oc-kbd-fallback" aria-hidden="true">
        {fallback}
      </span>
    ) : null
  }

  return (
    <kbd className={className} aria-hidden={label ? undefined : true}>
      <span>{label || '\u00a0'}</span>
    </kbd>
  )
}

export function KeyHints({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const enabled = useKeybindingsEnabled()
  if (!enabled) {
    return null
  }
  return <span className={`oc-key-hints ${className ?? ''}`}>{children}</span>
}
