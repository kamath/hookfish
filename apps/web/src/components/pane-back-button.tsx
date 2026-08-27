import { paneBarButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'

export function PaneBackButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      data-oc-pane-back
      className={`${paneBarButtonClass}${className ? ` ${className}` : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      {label}
      <KeyHints>
        <Kbd hotkey="Escape" />
      </KeyHints>
    </button>
  )
}
