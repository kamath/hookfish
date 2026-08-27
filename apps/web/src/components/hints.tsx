import { useEffect, useState, type ReactNode } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'

export function Kbd({
  hotkey,
  persistent,
}: {
  hotkey: RegisterableHotkey | string
  persistent?: boolean
}) {
  const [label, setLabel] = useState(() =>
    typeof hotkey === 'string' ? hotkey : '',
  )
  const className = persistent ? undefined : 'oc-key-hint'

  useEffect(() => {
    setLabel(formatForDisplay(hotkey))
  }, [hotkey])

  if (!label) {
    return <kbd className={className} aria-hidden="true">&nbsp;</kbd>
  }

  return <kbd className={className}>{label}</kbd>
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
