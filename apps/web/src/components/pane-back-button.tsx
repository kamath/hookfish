import type { ReactNode } from 'react'
import { paneBarButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'

export function BackCaret() {
  return (
    <span aria-hidden="true" className="text-base leading-none">
      ‹
    </span>
  )
}

export function PaneBackButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      data-oc-pane-back
      className={`${paneBarButtonClass}${className ? ` ${className}` : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      {children ?? (
        <>
          <BackCaret />
          {label}
        </>
      )}
      <KeyHints>
        <Kbd hotkey="Escape" />
      </KeyHints>
    </button>
  )
}
