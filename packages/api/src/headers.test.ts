import assert from 'node:assert/strict'
import { decodeCustomHeaders, parseHeaderText, validateHeaderEntries } from './headers'

assert.equal(parseHeaderText(''), undefined)
assert.equal(parseHeaderText('Bearer abc'), undefined)
assert.deepEqual(parseHeaderText('Authorization: Bearer a=b\nX-Api-Key:  k1 \n\n'), [
  { name: 'Authorization', value: 'Bearer a=b' },
  { name: 'X-Api-Key', value: 'k1' },
])
assert.deepEqual(
  parseHeaderText('# creds\nexport API_KEY="k:1"\nX_TEAM=\'core\'\nEMPTY=\n'),
  [
    { name: 'API_KEY', value: 'k:1' },
    { name: 'X_TEAM', value: 'core' },
    { name: 'EMPTY', value: '' },
  ],
)
assert.deepEqual(parseHeaderText('{"X-Api-Key": "k1", "X-Retries": 3, "X-Null": null}'), [
  { name: 'X-Api-Key', value: 'k1' },
  { name: 'X-Retries', value: '3' },
  { name: 'X-Null', value: '' },
])
assert.equal(parseHeaderText('{"X-Nested": {"a": 1}}'), undefined)
assert.equal(parseHeaderText('["X-A"]'), undefined)
assert.equal(parseHeaderText('{not json'), undefined)
assert.equal(parseHeaderText('X-Ok: 1\nno separator'), undefined)

assert.deepEqual(validateHeaderEntries([]), { ok: true, headers: {} })
assert.deepEqual(
  validateHeaderEntries([
    { name: ' X-Api-Key ', value: ' k1 ' },
    { name: '', value: '' },
  ]),
  { ok: true, headers: { 'X-Api-Key': 'k1' } },
)

const missingName = validateHeaderEntries([{ name: '', value: 'k1' }])
assert.match(!missingName.ok ? missingName.error : '', /needs a name/)

const badName = validateHeaderEntries([{ name: 'Bad Name', value: '2' }])
assert.match(!badName.ok ? badName.error : '', /"Bad Name" is not a valid header name/)

for (const name of [
  'Host',
  'cookie',
  'Content-Length',
  'x-hookfish-mcp-authorization',
  'Mcp-Session-Id',
]) {
  assert.equal(validateHeaderEntries([{ name, value: 'x' }]).ok, false, name)
}

assert.equal(validateHeaderEntries([{ name: 'X-Big', value: 'a'.repeat(9_000) }]).ok, false)

assert.deepEqual(decodeCustomHeaders(null), {})
assert.deepEqual(decodeCustomHeaders('[]'), {})
assert.deepEqual(decodeCustomHeaders('{"X-A":"1","X-B":2,"Host":"h"}'), { 'X-A': '1' })

console.log('headers tests passed')
