import { Link } from '@tanstack/react-router'

export const BRAND_NAME = 'Hookfish'
export const BRAND_ICON = '🐟'

export function Brand({
  compact = false,
  hero = false,
}: {
  compact?: boolean
  hero?: boolean
}) {
  const mark = (
    <Link
      to="/"
      className={
        hero
          ? 'inline-flex items-center gap-5 font-mono text-8xl leading-none text-ink outline-none hover:text-signal focus-visible:text-signal'
          : 'inline-flex min-h-8 shrink-0 items-center gap-2 font-mono text-sm leading-none text-ink outline-none hover:text-signal focus-visible:text-signal'
      }
      aria-label={compact ? `${BRAND_NAME} home` : undefined}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-[1em] items-center justify-center text-[1em] leading-none"
      >
        {BRAND_ICON}
      </span>
      {compact ? (
        <span className="sr-only">{BRAND_NAME}</span>
      ) : (
        <span className="leading-none">{BRAND_NAME}</span>
      )}
    </Link>
  )

  return hero ? <h1 className="m-0">{mark}</h1> : mark
}
