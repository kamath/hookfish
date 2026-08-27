import { paneBarButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'

export function PaneBackButton({
  label,
  onClick,
  className,
  compactLabel,
}: {
  label: string
  onClick: () => void
  className?: string
  compactLabel?: string
}) {
  return (
    <button
      type="button"
      className={`${paneBarButtonClass}${className ? ` ${className}` : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      {compactLabel ? (
        <>
          <span className="md:hidden">{compactLabel}</span>
          <span className="max-md:hidden">{label}</span>
        </>
      ) : (
        label
      )}
      <KeyHints>
        <Kbd hotkey="Escape" />
      </KeyHints>
    </button>
  )
}
