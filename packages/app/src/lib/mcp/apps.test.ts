import assert from 'node:assert/strict'
import {
  MCP_APPS_EXTENSION_ID,
  appContentSecurityPolicy,
  appDocument,
  appResourceFrom,
  callableFromApp,
  clampAppHeight,
  isOpenableLink,
  mcpAppsClientExtensions,
  toolApp,
  visibleToModel,
} from './apps'
import { APP_ONLY_TOOLS_GROUP, appAnnotations } from './source'

assert.deepEqual(mcpAppsClientExtensions, {
  'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] },
})
assert.equal(MCP_APPS_EXTENSION_ID, 'io.modelcontextprotocol/ui')
console.log('mcp apps capability ok')

assert.equal(toolApp({ name: 'plain' }), undefined)
assert.deepEqual(toolApp({ name: 'w', _meta: { ui: { resourceUri: 'ui://weather/view' } } }), {
  resourceUri: 'ui://weather/view',
  visibility: undefined,
})
assert.deepEqual(toolApp({ name: 'w', _meta: { 'ui/resourceUri': 'ui://legacy/view' } }), {
  resourceUri: 'ui://legacy/view',
  visibility: undefined,
})
assert.equal(toolApp({ name: 'w', _meta: { ui: { resourceUri: 'https://x.test' } } }), undefined)
const appOnly = toolApp({
  name: 'refresh',
  _meta: { ui: { resourceUri: 'ui://weather/view', visibility: ['app', 'bogus'] } },
})
assert.deepEqual(appOnly, { resourceUri: 'ui://weather/view', visibility: ['app'] })
assert.equal(visibleToModel(appOnly), false)
assert.equal(callableFromApp(appOnly), true)
assert.equal(visibleToModel(undefined), true)
assert.equal(callableFromApp(undefined), true)
assert.equal(callableFromApp({ resourceUri: 'ui://a', visibility: ['model'] }), false)
console.log('mcp apps tool metadata ok')

assert.deepEqual(appAnnotations(undefined), [])
assert.deepEqual(
  appAnnotations(appOnly).map((annotation) => annotation.label),
  ['app', 'app-only'],
)
assert.equal(APP_ONLY_TOOLS_GROUP, 'App-only tools')
console.log('mcp apps annotations ok')

const strict = appContentSecurityPolicy(undefined)
assert.match(strict, /default-src 'none'/)
assert.match(strict, /connect-src 'none'/)
assert.match(strict, /frame-src 'none'/)
assert.doesNotMatch(strict, /unsafe-eval/)
const open = appContentSecurityPolicy({
  connectDomains: ['https://api.example.com', 'bad; script-src *'],
  resourceDomains: ['https://cdn.example.com'],
  frameDomains: ['https://www.youtube.com'],
})
assert.match(open, /connect-src https:\/\/api\.example\.com;/)
assert.match(open, /script-src 'self' 'unsafe-inline' blob: https:\/\/cdn\.example\.com/)
assert.match(open, /img-src data: blob: https:\/\/cdn\.example\.com/)
assert.match(open, /frame-src https:\/\/www\.youtube\.com/)
assert.doesNotMatch(open, /script-src \*/)
console.log('mcp apps csp ok')

const withHead = appDocument('<html><head><title>x</title></head><body></body></html>', undefined)
assert.ok(withHead.startsWith('<html><head><meta http-equiv="Content-Security-Policy"'))
assert.ok(withHead.indexOf('Content-Security-Policy') < withHead.indexOf('<title>'))
assert.match(
  appDocument('<html lang="en"><body>x</body></html>', undefined),
  /^<html lang="en"><head><meta http-equiv="Content-Security-Policy"[^>]+><\/head><body>/,
)
assert.match(appDocument('<p>hi</p>', undefined), /^<!doctype html><html><head><meta [^>]+><\/head><body><p>hi<\/p>/)
console.log('mcp apps document ok')

const read = appResourceFrom('ui://weather/view', {
  contents: [
    {
      uri: 'ui://weather/view',
      mimeType: 'text/html;profile=mcp-app',
      text: '<p>weather</p>',
      _meta: {
        ui: {
          csp: { connectDomains: ['https://api.example.com'] },
          permissions: { clipboardWrite: {}, camera: {} },
        },
      },
    },
  ],
})
assert.equal(read.html, '<p>weather</p>')
assert.deepEqual(read.csp, { connectDomains: ['https://api.example.com'] })
assert.equal(read.allow, 'camera; clipboard-write')
assert.equal(
  appResourceFrom('ui://b', {
    contents: [
      {
        uri: 'ui://b',
        mimeType: 'text/html;profile=mcp-app',
        blob: Buffer.from('<p>blob</p>').toString('base64'),
      },
    ],
  }).html,
  '<p>blob</p>',
)
assert.throws(
  () => appResourceFrom('ui://c', { contents: [{ uri: 'ui://c', mimeType: 'text/plain', text: 'x' }] }),
  /not an MCP App/,
)
assert.throws(() => appResourceFrom('ui://d', { contents: [] }), /no content/)
console.log('mcp apps resource ok')

assert.equal(isOpenableLink('https://example.com'), true)
assert.equal(isOpenableLink('javascript:alert(1)'), false)
assert.equal(isOpenableLink('not a url'), false)
assert.equal(clampAppHeight(undefined, 360), 360)
assert.equal(clampAppHeight(10, 360), 80)
assert.equal(clampAppHeight(512.2, 360), 513)
assert.equal(clampAppHeight(99999, 360), 4000)
console.log('mcp apps helpers ok')
