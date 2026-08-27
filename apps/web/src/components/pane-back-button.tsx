import type { ReactNode } from 'react'
import { paneBarButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'

export function BackCaret() {
  return (
    <span aria-hidden="true" className="inline-flex size-4 items-center justify-center text-sm leading-none">
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
          <span className="leading-none">{label}</span>
        </>
      )}
      <KeyHints>
        <Kbd hotkey="Escape" />
      </KeyHints>
    </button>
  )
}
