import assert from 'node:assert/strict'
import { decodeCustomHeaders, parseHeaderLines } from './headers'

assert.deepEqual(parseHeaderLines(''), { ok: true, headers: {} })
assert.deepEqual(parseHeaderLines('\n  \n'), { ok: true, headers: {} })
assert.deepEqual(parseHeaderLines('Authorization: Bearer a:b\nX-Api-Key:  k1 \n\n'), {
  ok: true,
  headers: { Authorization: 'Bearer a:b', 'X-Api-Key': 'k1' },
})
assert.deepEqual(parseHeaderLines('X-Empty:'), { ok: true, headers: { 'X-Empty': '' } })

const missingColon = parseHeaderLines('X-Api-Key k1')
assert.equal(missingColon.ok, false)
assert.match(!missingColon.ok ? missingColon.error : '', /Line 1: use "Name: value"/)

const badName = parseHeaderLines('X-Ok: 1\nBad Name: 2')
assert.equal(badName.ok, false)
assert.match(!badName.ok ? badName.error : '', /Line 2: "Bad Name" is not a valid header name/)

for (const name of [
  'Host',
  'cookie',
  'Content-Length',
  'x-hookfish-mcp-authorization',
  'Mcp-Session-Id',
]) {
  assert.equal(parseHeaderLines(`${name}: x`).ok, false, name)
}

assert.equal(parseHeaderLines(`X-Big: ${'a'.repeat(9_000)}`).ok, false)

assert.deepEqual(decodeCustomHeaders(null), {})
assert.deepEqual(decodeCustomHeaders('[]'), {})
assert.deepEqual(decodeCustomHeaders('{"X-A":"1","X-B":2,"Host":"h"}'), { 'X-A': '1' })

console.log('headers tests passed')
