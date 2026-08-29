import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { AuthRedirectView } from './auth-status.tsx'
import { StatusPane } from './query-status.tsx'

const href = 'https://auth.example/authorize?client_id=1'

function render(remaining: number) {
  return renderToString(
    createElement(AuthRedirectView, {
      href,
      name: 'Arcade Omni',
      remaining,
      onGoNow() {},
      onCancel() {},
    }),
  )
}

const waiting = render(7)
assert.match(waiting, /Sign in to Arcade Omni/)
assert.match(waiting, /Sending you to/)
assert.match(waiting, /auth\.example/)
assert.match(waiting, /in/)
assert.match(waiting, />7</)
assert.match(waiting, /Go now/)
assert.match(waiting, /Cancel/)
assert.doesNotMatch(waiting, />now</)

const done = render(0)
assert.match(done, /Sending you to/)
assert.match(done, />now</)
assert.doesNotMatch(done, /Go now/)
assert.doesNotMatch(done, /Cancel/)
assert.doesNotMatch(done, />0</)

const takeover = renderToString(createElement(StatusPane, null, 'Sign in to Linear'))
assert.match(takeover, /id="main"/)
assert.match(takeover, /h-full/)
assert.match(takeover, /overflow-hidden/)
assert.match(takeover, /bg-paper/)
assert.match(takeover, /flex-1/)
assert.match(takeover, /Sign in to Linear/)
assert.doesNotMatch(takeover, /absolute/)

const home = readFileSync(new URL('../pages/home.tsx', import.meta.url), 'utf8')
assert.match(home, /StatusPane/)
assert.doesNotMatch(home, /absolute inset-0 z-10/)

console.log('auth redirect wait copy ok')
