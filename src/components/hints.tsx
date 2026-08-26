import { useEffect, useState } from 'react'
import { formatForDisplay } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'

export function Kbd({ hotkey }: { hotkey: RegisterableHotkey | string }) {
  const [label, setLabel] = useState(() =>
    typeof hotkey === 'string' ? hotkey : '',
  )

  useEffect(() => {
    setLabel(formatForDisplay(hotkey))
  }, [hotkey])

  if (!label) {
    return <kbd aria-hidden="true">&nbsp;</kbd>
  }

  return <kbd>{label}</kbd>
}

export function Hint({
  hotkey,
  label,
}: {
  hotkey: RegisterableHotkey | string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-mute">
      <Kbd hotkey={hotkey} />
      {label}
    </span>
  )
}

export function HintBar({
  items,
}: {
  items: Array<{ hotkey: RegisterableHotkey | string; label: string }>
}) {
  return (
    <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-rule px-3 py-2 md:px-4">
      {items.map((item, index) => (
        <Hint key={`${item.label}-${index}`} hotkey={item.hotkey} label={item.label} />
      ))}
    </footer>
  )
}
