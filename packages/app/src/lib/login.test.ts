import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paneConfig } from './keymap.ts'

const login = readFileSync(new URL('../pages/login.tsx', import.meta.url), 'utf8')

assert.doesNotMatch(login, /uppercase text-mute">Account/, 'login has no Account caption')
assert.doesNotMatch(login, /OpenAPI client/, 'login does not advertise the RPC client')
assert.doesNotMatch(login, /Enter email and password/)
assert.doesNotMatch(login, /Enter a name, email, and password/)
assert.match(login, /activate\('login'/)
useSourceToolbarMustGoBack()
assert.match(login, /useFormPaneNavigation\('login', 'login-form'\)/)
assert.match(login, /hotkey="C"/)
assert.doesNotMatch(login, /hotkey="S"/)
assert.doesNotMatch(login, /hotkey="Mod"/)
assert.match(login, /hotkey="Enter"/)
assert.match(login, />\s*Cancel\s*/)
assert.match(login, /<Kbd hotkey="Escape" \/>/)
assert.match(login, /data-oc-enter-submit="true"/)

const bindings = paneConfig.login.bindings
assert.equal(paneConfig.login.parent, 'specs')
assert.equal(bindings.find((binding) => binding.id === 'parent')?.hotkey, 'Escape')
assert.equal(bindings.find((binding) => binding.id === 'submitNow')?.hotkey, 'Enter')
assert.equal(bindings.find((binding) => binding.id === 'switchAuthMode')?.hotkey, 'C')
assert.equal(
  bindings.filter((binding) => binding.hotkey === 'C').length,
  1,
  'login registers one C handler',
)
assert.equal(
  bindings.filter((binding) => binding.hotkey === 'S').length,
  0,
  'S does not submit from the login form',
)

const home = readFileSync(new URL('../pages/home.tsx', import.meta.url), 'utf8')
assert.match(home, /signIn:/)
assert.match(home, /to: '\/login'/)
assert.ok(bindings.some((binding) => binding.id === 'insert'))
assert.ok(bindings.some((binding) => binding.id === 'next'))

function useSourceToolbarMustGoBack() {
  assert.match(login, /useSourceToolbar/)
  assert.match(login, /onBack: goBack/)
}

console.log('login pane chrome ok')
