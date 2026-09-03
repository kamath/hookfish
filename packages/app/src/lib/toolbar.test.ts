import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getDefaultStore } from 'jotai'
import { sourceToolbarAtom } from './toolbar.ts'

const store = getDefaultStore()
assert.equal(store.get(sourceToolbarAtom), null, 'toolbar starts empty off a source page')

const root = readFileSync(new URL('../app.tsx', import.meta.url), 'utf8')
const toolbar = root.slice(root.indexOf('function AppToolbar'), root.indexOf('function TrashIcon'))
assert.match(toolbar, /useSourceToolbarValue/)
assert.match(toolbar, /Clear auth/)
assert.match(toolbar, /Mod\+Backspace/)
assert.match(toolbar, /<CloudToggle \/>/)
assert.match(toolbar, /className="flex shrink-0 items-center/)
assert.doesNotMatch(toolbar, /className="oc-bar[\s"]/, 'navbar keeps the paper background')

const page = readFileSync(
  new URL('../pages/workbench.tsx', import.meta.url),
  'utf8',
)
assert.match(page, /useSourceToolbar/)
assert.doesNotMatch(page, /Brand compact/)
assert.doesNotMatch(page, /Clear credentials/)
assert.doesNotMatch(page, /Clear auth/)

console.log('source toolbar chrome ok')
