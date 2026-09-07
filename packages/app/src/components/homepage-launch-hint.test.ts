import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { HomepageLaunchHint } from './homepage-launch-hint.tsx'
import { GITHUB_REPO_URL } from './github-link.tsx'

const hosted = renderToString(
  createElement(HomepageLaunchHint, {
    location: { hostname: 'hookfish.dev', port: '443', protocol: 'https:' },
  }),
)
assert.match(hosted, /Run it yourself/)
assert.match(hosted, /npx hookfish up/)
assert.match(hosted, new RegExp(GITHUB_REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.doesNotMatch(hosted, /Running locally/)
assert.doesNotMatch(hosted, /MIT License/)

const local = renderToString(
  createElement(HomepageLaunchHint, {
    location: { hostname: '127.0.0.1', port: '4001', protocol: 'http:' },
  }),
)
assert.match(local, /Running locally on port 4001/)
assert.doesNotMatch(local, /Run it yourself/)
assert.doesNotMatch(local, /npx hookfish up/)

console.log('homepage launch hint renders hosted and local copy')
