import { THEME_PREFERENCES, useTheme, type ThemePreference } from '../lib/theme'

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

function SystemIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  )
}

function LightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2.5M12 18v2.5M3.5 12h2.5M18 12h2.5M6.2 6.2l1.8 1.8M16 16l1.8 1.8M6.2 17.8l1.8-1.8M16 8l1.8-1.8" />
    </svg>
  )
}

function DarkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />
    </svg>
  )
}

const ICONS: Record<ThemePreference, typeof SystemIcon> = {
  system: SystemIcon,
  light: LightIcon,
  dark: DarkIcon,
}

export function ThemeToggle() {
  const [theme, setTheme] = useTheme()

  return (
    <div role="radiogroup" aria-label="Color theme" className="flex shrink-0">
      {THEME_PREFERENCES.map((preference) => {
        const selected = theme === preference
        const Icon = ICONS[preference]
        return (
          <button
            key={preference}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LABELS[preference]}
            title={LABELS[preference]}
            className={`inline-flex size-8 items-center justify-center outline-none ${
              selected
                ? 'bg-ink/10 text-ink'
                : 'text-mute hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink'
            }`}
            onClick={() => setTheme(preference)}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
