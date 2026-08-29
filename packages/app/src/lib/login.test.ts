import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paneConfig } from './keymap.ts'

const login = readFileSync(new URL('../pages/login.tsx', import.meta.url), 'utf8')

assert.doesNotMatch(login, /uppercase text-mute">Account/, 'login has no Account caption')
assert.doesNotMatch(login, /OpenAPI client/, 'login does not advertise the RPC client')
assert.match(login, /Enter email and password/)
assert.match(login, /Enter a name, email, and password/)
assert.match(login, /activate\('login'/)
useSourceToolbarMustGoBack()
assert.match(login, /useFormPaneNavigation\('login', 'login-form'\)/)
assert.match(login, /hotkey=\{mode === 'sign-in' \? 'C' : 'S'\}/)
assert.match(login, /hotkey="Mod"/)
assert.match(login, /data-oc-enter-submit="true"/)

const bindings = paneConfig.login.bindings
assert.equal(paneConfig.login.parent, 'specs')
assert.equal(bindings.find((binding) => binding.id === 'parent')?.hotkey, 'Escape')
assert.equal(bindings.find((binding) => binding.id === 'send')?.hotkey, 'Mod+Enter')
assert.equal(bindings.find((binding) => binding.id === 'createAccount')?.hotkey, 'C')
assert.equal(bindings.find((binding) => binding.id === 'useAccount')?.hotkey, 'S')
assert.ok(bindings.some((binding) => binding.id === 'insert'))
assert.ok(bindings.some((binding) => binding.id === 'next'))

function useSourceToolbarMustGoBack() {
  assert.match(login, /useSourceToolbar/)
  assert.match(login, /onBack: goBack/)
}

console.log('login pane chrome ok')
