import { useEffect, useState, type ReactNode } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'

export function Kbd({ hotkey }: { hotkey: RegisterableHotkey | string }) {
  const [label, setLabel] = useState(() =>
    typeof hotkey === 'string' ? hotkey : '',
  )

  useEffect(() => {
    const formatted = formatForDisplay(hotkey)
    setLabel(hotkey === 'Tab' ? `${formatted} Tab` : formatted)
  }, [hotkey])

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
