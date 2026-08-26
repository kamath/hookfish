import { useEffect, useState, type ReactNode } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import { useShowKeybindings, useVisibleHints } from '../lib/keymap'

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

export function Hint({
  hotkey,
  label,
}: {
  hotkey: RegisterableHotkey | string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-mute">
      <Kbd hotkey={hotkey} />
      {label}
    </span>
  )
}

export function HintBar() {
  const items = useVisibleHints()
  if (items.length === 0) {
    return null
  }

  return (
    <footer className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 border-t border-rule px-3 py-2 md:px-4">
      {items.map((item, index) => (
        <Hint key={`${item.label}-${index}`} hotkey={item.hotkey} label={item.label} />
      ))}
    </footer>
  )
}
