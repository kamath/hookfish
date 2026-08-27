import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { AuthRedirectView } from './auth-status.tsx'

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

console.log('auth redirect wait copy ok')
