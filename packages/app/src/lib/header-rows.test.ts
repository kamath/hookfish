import assert from 'node:assert/strict'
import { addHeaderRow, headerRowsOrBlank, pasteHeaderRows, pastedHeaders } from './header-rows'

const blank = { name: '', value: '' }
const a = { name: 'X-A', value: '1' }
const b = { name: 'X-B', value: '2' }

assert.deepEqual(headerRowsOrBlank([]), [blank])
assert.deepEqual(headerRowsOrBlank([a]), [a])

assert.deepEqual(addHeaderRow([a]), { rows: [a, blank], index: 1 })
assert.deepEqual(addHeaderRow([a, b], 0), { rows: [a, blank, b], index: 1 })
assert.deepEqual(addHeaderRow([a, blank], 0), { rows: [a, blank], index: 1 })
assert.deepEqual(addHeaderRow([a, blank]), { rows: [a, blank], index: 1 })
assert.deepEqual(addHeaderRow([]), { rows: [blank], index: 0 })

assert.deepEqual(pastedHeaders('API_KEY=k1', 'name'), [{ name: 'API_KEY', value: 'k1' }])
assert.equal(pastedHeaders('Bearer a=b', 'value'), undefined)
assert.equal(pastedHeaders('{"a":"1"}', 'value'), undefined)
assert.deepEqual(pastedHeaders('A=1\nB=2\n', 'value'), [
  { name: 'A', value: '1' },
  { name: 'B', value: '2' },
])
assert.equal(pastedHeaders('X-Api-Key', 'name'), undefined)

assert.deepEqual(
  pasteHeaderRows(
    [{ name: 'X-Keep', value: '1' }, { name: 'x-api-key', value: 'old' }, blank],
    2,
    [
      { name: 'X-Api-Key', value: 'new' },
      { name: 'X-Team', value: 'core' },
    ],
  ),
  [
    { name: 'X-Keep', value: '1' },
    { name: 'X-Api-Key', value: 'new' },
    { name: 'X-Team', value: 'core' },
  ],
)

assert.deepEqual(pasteHeaderRows([blank, b], 0, [a]), [a, b])

console.log('header rows tests passed')
