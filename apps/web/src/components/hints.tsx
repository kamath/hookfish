import { useEffect, useState, type ReactNode } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'

export function Kbd({
  hotkey,
  label: displayLabel,
}: {
  hotkey: RegisterableHotkey | string
  label?: string
}) {
  const [label, setLabel] = useState(() =>
    displayLabel ?? (typeof hotkey === 'string' ? hotkey : ''),
  )

  useEffect(() => {
    setLabel(displayLabel ?? formatForDisplay(hotkey))
  }, [hotkey, displayLabel])

  if (!label) {
    return <kbd className="oc-key-hint" aria-hidden="true">&nbsp;</kbd>
  }

  return <kbd className="oc-key-hint">{label}</kbd>
}

export function KeyHints({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={`oc-key-hints ${className ?? ''}`}>{children}</span>
}
