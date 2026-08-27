import assert from 'node:assert/strict'
import {
  buildNode,
  expandedIds,
  parseJsonBody,
  selectedJsonText,
  visibleNodes,
} from './json-tree.ts'

const object = buildNode({ description: 'Echo', outputSchema: { type: 'string' } })
assert.equal(object.collection, 'object')
assert.equal(object.children?.length, 2)
assert.equal(object.children?.[0]?.label, 'description')
assert.equal(object.children?.[0]?.value, 'Echo')

const collapsed = visibleNodes(object, new Set())
assert.equal(collapsed.length, 1)
const expanded = visibleNodes(object, new Set([object.id]))
assert.equal(expanded.length, 4)
assert.equal(expanded[3]?.value, '}')
assert.deepEqual([...expandedIds(object, 0)], [object.id])
assert.ok(expandedIds(object, 1).has(object.id))

const parsed = parseJsonBody(JSON.stringify({ ok: true }))
assert.ok(parsed.root)
assert.equal(selectedJsonText(parsed.root, parsed.root), JSON.stringify({ ok: true }, null, 2))
const ok = parsed.root.children?.[0]
assert.ok(ok)
assert.equal(selectedJsonText(parsed.root, ok), JSON.stringify({ ok: true }, null, 2))

const lines = parseJsonBody('not json')
assert.deepEqual(lines.lines, ['not json'])
assert.equal(parseJsonBody('').lines?.[0], 'Empty body')

console.log('json tree helpers ok')
