import assert from 'node:assert/strict'
import { hotkeysFor, paneConfig } from './keymap.ts'

assert.deepEqual(hotkeysFor({ id: 'next', hotkey: 'J', label: 'next' }), ['J'])
assert.deepEqual(
  hotkeysFor({ id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next' }),
  ['J', 'ArrowDown'],
)

for (const [pane, config] of Object.entries(paneConfig)) {
  const next = config.bindings.find((binding) => binding.id === 'next')
  const previous = config.bindings.find((binding) => binding.id === 'previous')
  assert.ok(next, `${pane} has a next binding`)
  assert.ok(previous, `${pane} has a previous binding`)
  assert.ok(
    hotkeysFor(next).includes('J') && hotkeysFor(next).includes('ArrowDown'),
    `${pane} next is J and ArrowDown`,
  )
  assert.ok(
    hotkeysFor(previous).includes('K') && hotkeysFor(previous).includes('ArrowUp'),
    `${pane} previous is K and ArrowUp`,
  )
}
