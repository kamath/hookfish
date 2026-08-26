import { useEffect, useState, type ReactNode } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import { useShowKeybindings } from '../lib/keymap'

export function useKeybindingsVisible() {
  return useShowKeybindings()
}

export function Kbd({ hotkey }: { hotkey: RegisterableHotkey | string }) {
  const visible = useShowKeybindings()
  const [label, setLabel] = useState(() =>
    typeof hotkey === 'string' ? hotkey : '',
  )

  useEffect(() => {
    setLabel(formatForDisplay(hotkey))
  }, [hotkey])

  if (!visible) {
    return null
  }

  if (!label) {
    return <kbd aria-hidden="true">&nbsp;</kbd>
  }

  return <kbd>{label}</kbd>
}

export function KeyHints({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const visible = useShowKeybindings()
  if (!visible) {
    return null
  }
  return <span className={className}>{children}</span>
}
