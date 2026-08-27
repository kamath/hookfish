import { THEME_PREFERENCES, useTheme, type ThemePreference } from '../lib/theme'

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

export function ThemeToggle() {
  const [theme, setTheme] = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="ml-auto flex shrink-0 bg-ink/10 text-xs"
    >
      {THEME_PREFERENCES.map((preference) => {
        const selected = theme === preference
        return (
          <button
            key={preference}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`inline-flex min-h-8 items-center px-2.5 py-1 font-medium outline-none ${
              selected
                ? 'bg-paper text-ink'
                : 'text-mute hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink'
            }`}
            onClick={() => setTheme(preference)}
          >
            {LABELS[preference]}
          </button>
        )
      })}
    </div>
  )
}
