import assert from 'node:assert/strict'
import { pasteHeaderRows, pastedHeaders, withTrailingRow } from './header-rows'

const blank = { name: '', value: '' }

assert.deepEqual(withTrailingRow([]), [blank])
assert.deepEqual(withTrailingRow([blank]), [blank])
assert.deepEqual(withTrailingRow([{ name: 'X-A', value: '1' }]), [
  { name: 'X-A', value: '1' },
  blank,
])

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
    blank,
  ],
)

assert.deepEqual(
  pasteHeaderRows([blank, { name: 'X-After', value: '2' }, blank], 0, [
    { name: 'X-A', value: '1' },
  ]),
  [{ name: 'X-A', value: '1' }, { name: 'X-After', value: '2' }, blank],
)

console.log('header rows tests passed')
