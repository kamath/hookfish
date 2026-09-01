import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getDefaultStore } from 'jotai'
import { sourceToolbarAtom } from './toolbar.ts'

const store = getDefaultStore()
assert.equal(store.get(sourceToolbarAtom), null, 'toolbar starts empty off a source page')

const root = readFileSync(new URL('../app.tsx', import.meta.url), 'utf8')
const toolbar = root.slice(root.indexOf('function AppToolbar'), root.indexOf('function TrashIcon'))
assert.match(toolbar, /useSourceToolbarValue/)
assert.match(toolbar, /Last updated at/)
assert.match(toolbar, /Refresh/)
assert.match(toolbar, /hotkey="R"/)
assert.match(toolbar, /Clear auth/)
assert.match(toolbar, /Mod\+Backspace/)
assert.match(toolbar, /AccountMenu/)

const account = readFileSync(new URL('../components/account-menu.tsx', import.meta.url), 'utf8')
assert.match(account, /to="\/login"/)
assert.match(account, /hotkey="S"/)
assert.match(account, /to="\/api-keys"/)
assert.match(account, /Create API key/)
assert.match(account, /bg-ink\/10/)
assert.doesNotMatch(toolbar, /CloudToggle/)
assert.doesNotMatch(toolbar, /className="oc-bar[\s"]/, 'navbar keeps the paper background')

const page = readFileSync(
  new URL('../pages/workbench.tsx', import.meta.url),
  'utf8',
)
assert.match(page, /useSourceToolbar/)
assert.match(page, /refreshApi/)
assert.match(page, /updatedAt: api.updatedAt/)
assert.match(page, /sourceCredentialsStored/)

const apis = readFileSync(new URL('./apis.ts', import.meta.url), 'utf8')
assert.match(apis, /throw new SourceCacheMissingError/)
assert.match(apis, /lookupCachedSource/)
assert.match(apis, /source\.updatedAt/)
assert.doesNotMatch(
  apis.slice(apis.indexOf('export async function addApi'), apis.indexOf('export async function getApi')),
  /updatedAt = new Date/,
)
assert.match(apis, /loadLiveApi\(row, \{ force: true \}\)/)
assert.doesNotMatch(apis, /return loadLiveApi\(row\)/)

const queries = readFileSync(new URL('./queries.ts', import.meta.url), 'utf8')
assert.match(queries, /refetchOnMount:\s*'always'/)
assert.match(apis, /Sign in to refresh the cache/)
assert.match(apis, /options\?\.force \|\| isSourceRefreshTooSoonError/)
assert.match(page, /isSourceCacheMissingError/)
assert.match(page, /retryLabel=\{missingCache \? 'Refresh' : 'Try again'\}/)
assert.doesNotMatch(page, /subscribeMcpChanges/)
assert.doesNotMatch(page, /Brand compact/)
assert.doesNotMatch(page, /Clear credentials/)
assert.doesNotMatch(page, /Clear auth/)

console.log('source toolbar chrome ok')
