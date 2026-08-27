import assert from 'node:assert/strict'
import {
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  THEME_KEY,
  appearanceFor,
  applyTheme,
  isThemePreference,
  readThemePreference,
} from './theme.ts'

assert.equal(readThemePreference(null), 'system')
assert.equal(readThemePreference(undefined), 'system')
assert.equal(readThemePreference(''), 'system')
assert.equal(readThemePreference('nope'), 'system')
assert.equal(readThemePreference('light'), 'light')
assert.equal(readThemePreference('dark'), 'dark')
assert.equal(readThemePreference('system'), 'system')

assert.equal(isThemePreference('system'), true)
assert.equal(isThemePreference('light'), true)
assert.equal(isThemePreference('dark'), true)
assert.equal(isThemePreference('auto'), false)

assert.equal(appearanceFor('light', true), 'light')
assert.equal(appearanceFor('light', false), 'light')
assert.equal(appearanceFor('dark', true), 'dark')
assert.equal(appearanceFor('dark', false), 'dark')
assert.equal(appearanceFor('system', true), 'dark')
assert.equal(appearanceFor('system', false), 'light')

assert.equal(THEME_INIT_SCRIPT.includes(THEME_KEY), true)
assert.equal(THEME_INIT_SCRIPT.includes("t='system'"), true)

const attributes = new Map<string, string>([['name', 'theme-color'], ['content', THEME_COLORS.light]])
const meta = {
  getAttribute(name: string) {
    return attributes.get(name) ?? null
  },
  setAttribute(name: string, value: string) {
    attributes.set(name, value)
  },
}

let prefersDark = false
const documentElement = { dataset: {} as { theme?: string } }

Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement,
    querySelector(selector: string) {
      return selector === 'meta[name="theme-color"]' ? meta : null
    },
  },
  configurable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: {
    matchMedia(query: string) {
      return {
        matches: query.includes('prefers-color-scheme: dark') && prefersDark,
      }
    },
  },
  configurable: true,
})

applyTheme('system')
assert.equal(documentElement.dataset.theme, 'system')
assert.equal(meta.getAttribute('content'), THEME_COLORS.light)

prefersDark = true
applyTheme('system')
assert.equal(documentElement.dataset.theme, 'system')
assert.equal(meta.getAttribute('content'), THEME_COLORS.dark)

applyTheme('light')
assert.equal(documentElement.dataset.theme, 'light')
assert.equal(meta.getAttribute('content'), THEME_COLORS.light)

applyTheme('dark')
assert.equal(documentElement.dataset.theme, 'dark')
assert.equal(meta.getAttribute('content'), THEME_COLORS.dark)

console.log('theme tests passed')
