import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { CreateApiKeyView } from './create-api-key.tsx'

function render(created: boolean) {
  return renderToString(
    createElement(CreateApiKeyView, {
      id: 'create-api-key-form',
      name: 'Automation',
      expiration: '7 days',
      pending: false,
      error: null,
      created: created
        ? { name: 'Automation', expiresAt: '2026-09-05T00:00:00.000Z', key: 'hf_secret' }
        : null,
      copied: false,
      onNameChange() {},
      onExpirationChange() {},
      onSubmit() {},
      onCopy() {},
      onCancel() {},
    }),
  )
}

const form = render(false)
assert.match(form, /Name/)
assert.match(form, /Expiration/)
assert.match(form, /value="1 day"/)
assert.match(form, /value="7 days"/)
assert.match(form, /value="30 days"/)
assert.match(form, /value="90 days"/)
assert.match(form, /value="never"/)
assert.match(form, /Create API key/)
assert.match(form, /Cancel/)
assert.match(form, /flex-1/)
assert.match(form, /Mod\+Enter/)
assert.doesNotMatch(form, /data-oc-enter-submit/)
assert.doesNotMatch(form, /hf_secret/)

const revealed = render(true)
assert.match(revealed, /Copy this key now/)
assert.match(revealed, /hf_secret/)
assert.match(revealed, /Copy key/)
assert.match(revealed, /<span>Y<\/span>/)
assert.match(revealed, /<span>Escape<\/span>/)
assert.match(revealed, /Back/)
assert.doesNotMatch(revealed, /Create another/)
assert.doesNotMatch(revealed, /Expiration/)

const account = readFileSync(new URL('./account-menu.tsx', import.meta.url), 'utf8')
assert.match(account, /to="\/api-keys"/)
assert.match(account, /Create API key/)
assert.doesNotMatch(account, /CreateApiKeyForm/)
assert.doesNotMatch(account, /absolute right-0/)

const login = readFileSync(new URL('../pages/login.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(login, /CreateApiKeyForm/)

const page = readFileSync(new URL('../pages/create-api-key.tsx', import.meta.url), 'utf8')
assert.match(page, /activate\('apiKeys'/)
assert.match(page, /useFormPaneNavigation\('apiKeys', 'create-api-key-form'\)/)
assert.match(page, /id="api-keys-pane"/)

console.log('create api key ui ok')
