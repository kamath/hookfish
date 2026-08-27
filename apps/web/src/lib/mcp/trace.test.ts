import assert from 'node:assert/strict'
import type { ProtocolTraceEntry } from '../client-types'
import { groupProtocolTrace } from './trace'

function entry(
  partial: Pick<ProtocolTraceEntry, 'direction' | 'kind' | 'summary'> &
    Partial<Pick<ProtocolTraceEntry, 'atMs' | 'detail'>>,
): ProtocolTraceEntry {
  return {
    atMs: partial.atMs ?? 0,
    detail: partial.detail,
    direction: partial.direction,
    kind: partial.kind,
    summary: partial.summary,
  }
}

const grouped = groupProtocolTrace([
  entry({ atMs: 1, direction: 'out', kind: 'jsonrpc', summary: 'initialize' }),
  entry({ atMs: 2, direction: 'in', kind: 'http', summary: '200 OK' }),
  entry({ atMs: 3, direction: 'in', kind: 'jsonrpc', summary: 'RPC response 1' }),
  entry({ atMs: 4, direction: 'out', kind: 'jsonrpc', summary: 'tools/list' }),
  entry({ atMs: 5, direction: 'in', kind: 'jsonrpc', summary: 'RPC response 2' }),
  entry({ atMs: 6, direction: 'in', kind: 'notification', summary: 'notifications/tools/list_changed' }),
])

assert.equal(grouped.length, 3)
assert.equal(grouped[0]?.summary, 'initialize')
assert.equal(grouped[0]?.frames.length, 3)
assert.equal(grouped[1]?.summary, 'tools/list')
assert.equal(grouped[1]?.frames.length, 2)
assert.equal(grouped[2]?.summary, 'notifications/tools/list_changed')
assert.equal(grouped[2]?.frames.length, 1)
assert.equal(grouped[2]?.direction, 'in')

assert.deepEqual(groupProtocolTrace([]), [])
console.log('protocol trace grouping ok')
