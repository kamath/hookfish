import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { isProxyBlocked, ProxyBlockedActions } from './proxy-blocked-actions.tsx'
import { ProxyBlockedError } from '../lib/upstream.ts'

assert.ok(isProxyBlocked(new Error('wrapped', { cause: new ProxyBlockedError('blocked') })))
assert.equal(isProxyBlocked(new Error('plain')), false)

const hosted = renderToString(
  createElement(ProxyBlockedActions, {
    onRetry: () => {},
    location: { hostname: 'hookfish.dev', port: '443', protocol: 'https:' },
  }),
)
assert.match(hosted, /Use browser mode/)
assert.match(hosted, /npx hookfish up/)

const local = renderToString(
  createElement(ProxyBlockedActions, {
    onRetry: () => {},
    location: { hostname: 'localhost', port: '4000', protocol: 'http:' },
  }),
)
assert.match(local, /Use browser mode/)
assert.doesNotMatch(local, /npx hookfish up/)

console.log('proxy-blocked-actions tests passed')
