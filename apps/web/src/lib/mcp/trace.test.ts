import assert from 'node:assert/strict'
import type { JsonValue, ProtocolTraceEntry } from '../client-types'
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

function rpc(id: number, method: string): JsonValue {
  return { jsonrpc: '2.0', id, method }
}

function rpcResult(id: number): JsonValue {
  return { jsonrpc: '2.0', id, result: {} }
}

const sequential = groupProtocolTrace([
  entry({
    atMs: 1,
    direction: 'out',
    kind: 'jsonrpc',
    summary: 'initialize',
    detail: rpc(1, 'initialize'),
  }),
  entry({ atMs: 2, direction: 'in', kind: 'http', summary: '200 OK' }),
  entry({
    atMs: 3,
    direction: 'in',
    kind: 'jsonrpc',
    summary: 'RPC response 1',
    detail: rpcResult(1),
  }),
  entry({
    atMs: 4,
    direction: 'out',
    kind: 'jsonrpc',
    summary: 'tools/list',
    detail: rpc(2, 'tools/list'),
  }),
  entry({
    atMs: 5,
    direction: 'in',
    kind: 'jsonrpc',
    summary: 'RPC response 2',
    detail: rpcResult(2),
  }),
  entry({
    atMs: 6,
    direction: 'in',
    kind: 'notification',
    summary: 'notifications/tools/list_changed',
    detail: { jsonrpc: '2.0', method: 'notifications/tools/list_changed' },
  }),
])

assert.equal(sequential.length, 3)
assert.equal(sequential[0]?.summary, 'initialize')
assert.equal(sequential[0]?.frames.length, 3)
assert.equal(sequential[1]?.summary, 'tools/list')
assert.equal(sequential[1]?.frames.length, 2)
assert.equal(sequential[2]?.summary, 'notifications/tools/list_changed')
assert.equal(sequential[2]?.frames.length, 1)
assert.equal(sequential[2]?.direction, 'in')

const parallel = groupProtocolTrace([
  entry({
    atMs: 1,
    direction: 'out',
    kind: 'jsonrpc',
    summary: 'tools/list',
    detail: rpc(0, 'tools/list'),
  }),
  entry({
    atMs: 2,
    direction: 'out',
    kind: 'jsonrpc',
    summary: 'resources/list',
    detail: rpc(1, 'resources/list'),
  }),
  entry({ atMs: 3, direction: 'in', kind: 'http', summary: '200 OK' }),
  entry({ atMs: 4, direction: 'in', kind: 'http', summary: '200 OK' }),
  entry({
    atMs: 5,
    direction: 'in',
    kind: 'jsonrpc',
    summary: 'RPC response 1',
    detail: rpcResult(1),
  }),
  entry({
    atMs: 6,
    direction: 'in',
    kind: 'jsonrpc',
    summary: 'RPC response 0',
    detail: rpcResult(0),
  }),
])

assert.equal(parallel.length, 2)
assert.equal(parallel[0]?.summary, 'tools/list')
assert.deepEqual(
  parallel[0]?.frames.map((frame) => frame.summary),
  ['tools/list', '200 OK', 'RPC response 0'],
)
assert.equal(parallel[1]?.summary, 'resources/list')
assert.deepEqual(
  parallel[1]?.frames.map((frame) => frame.summary),
  ['resources/list', '200 OK', 'RPC response 1'],
)

assert.deepEqual(groupProtocolTrace([]), [])
console.log('protocol trace grouping ok')
