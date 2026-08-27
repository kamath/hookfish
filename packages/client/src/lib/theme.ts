import { atom, useAtomValue } from 'jotai'
import { store } from './chrome'
import { THEME_COLORS, THEME_KEY } from '../head'

export { THEME_COLORS, THEME_INIT_SCRIPT, THEME_KEY } from '../head'

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ThemeAppearance = 'light' | 'dark'

export const themeAtom = atom<ThemePreference>('system')

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    value === 'system' ||
    value === 'light' ||
    value === 'dark'
  )
}

export function readThemePreference(raw: string | null | undefined): ThemePreference {
  return isThemePreference(raw) ? raw : 'system'
}

export function appearanceFor(
  preference: ThemePreference,
  prefersDark: boolean,
): ThemeAppearance {
  if (preference === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return preference
}

export function prefersDarkScheme() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function applyTheme(preference: ThemePreference) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.dataset.theme = preference
  const appearance = appearanceFor(preference, prefersDarkScheme())
  const themeColor = THEME_COLORS[appearance]
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', themeColor)
  }
}

export function getTheme() {
  return store.get(themeAtom)
}

export function setTheme(preference: ThemePreference) {
  store.set(themeAtom, preference)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_KEY, preference)
  }
  applyTheme(preference)
}

export function hydrateTheme() {
  if (typeof window === 'undefined') {
    return
  }
  const preference = readThemePreference(window.localStorage.getItem(THEME_KEY))
  store.set(themeAtom, preference)
  applyTheme(preference)
}

export function bindTheme() {
  hydrateTheme()
  if (typeof window === 'undefined') {
    return () => {}
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => applyTheme(getTheme())
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useTheme() {
  return [useAtomValue(themeAtom), setTheme] as const
}
