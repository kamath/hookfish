import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  HomepageLaunchHint,
  LOCAL_LAUNCH_COMMAND,
  LOCAL_LAUNCH_COPIED,
} from './homepage-launch-hint.tsx'
import { GITHUB_REPO_URL } from './github-link.tsx'

const hosted = renderToString(
  createElement(HomepageLaunchHint, {
    location: { hostname: 'hookfish.dev', port: '443', protocol: 'https:' },
  }),
)
assert.match(hosted, /Run it yourself/)
assert.match(hosted, new RegExp(LOCAL_LAUNCH_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.match(hosted, /type="button"/)
assert.match(hosted, /bg-ink\/5/)
assert.match(hosted, new RegExp(`Copy ${LOCAL_LAUNCH_COMMAND}`))
assert.doesNotMatch(hosted, new RegExp(LOCAL_LAUNCH_COPIED))
assert.doesNotMatch(hosted, /<svg/)
assert.match(hosted, new RegExp(GITHUB_REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.doesNotMatch(hosted, /Running locally/)
assert.doesNotMatch(hosted, /MIT License/)

const local = renderToString(
  createElement(HomepageLaunchHint, {
    location: { hostname: '127.0.0.1', port: '4001', protocol: 'http:' },
  }),
)
assert.match(local, /Running locally on port/)
assert.match(local, /4001/)
assert.doesNotMatch(local, /Run it yourself/)
assert.doesNotMatch(
  local,
  new RegExp(LOCAL_LAUNCH_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
)

const injected = renderToString(
  createElement(HomepageLaunchHint, {
    location: { hostname: 'hookfish.dev', port: '443', protocol: 'https:' },
    runtime: { local: true, port: 3200 },
  }),
)
assert.match(injected, /Running locally on port/)
assert.match(injected, /3200/)
assert.doesNotMatch(injected, /Run it yourself/)

console.log('homepage launch hint renders hosted and local copy')
