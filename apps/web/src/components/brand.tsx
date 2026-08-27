import { Link } from '@tanstack/react-router'

export const BRAND_NAME = 'Hookfish'
export const BRAND_ICON = '🐟'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex min-h-8 shrink-0 items-center gap-2 text-sm text-ink outline-none hover:text-signal focus-visible:text-signal"
      aria-label={compact ? `${BRAND_NAME} home` : undefined}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {BRAND_ICON}
      </span>
      {compact ? <span className="sr-only">{BRAND_NAME}</span> : <span>{BRAND_NAME}</span>}
    </Link>
  )
}
