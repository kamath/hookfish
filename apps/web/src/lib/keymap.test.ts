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

for (const pane of ['routes', 'input'] as const) {
  const nextTab = paneConfig[pane].bindings.find((binding) => binding.id === 'nextTab')
  const previousTab = paneConfig[pane].bindings.find((binding) => binding.id === 'previousTab')
  assert.ok(nextTab, `${pane} has a nextTab binding`)
  assert.ok(previousTab, `${pane} has a previousTab binding`)
  assert.equal(nextTab.hotkey, 'Tab', `${pane} nextTab is Tab`)
  assert.equal(previousTab.hotkey, 'Shift+Tab', `${pane} previousTab is Shift+Tab`)
}

const routesNext = paneConfig.routes.bindings.find((binding) => binding.id === 'next')
const routesNextTab = paneConfig.routes.bindings.find((binding) => binding.id === 'nextTab')
assert.equal(routesNext?.label, routesNextTab?.label, 'routes J and Tab share a label')

const submitBindings = paneConfig.specs.bindings.filter((binding) =>
  binding.id.startsWith('submit-'),
)
assert.ok(submitBindings.length > 0, 'specs has submit bindings')
for (const binding of submitBindings) {
  assert.deepEqual(binding.modes, ['edit'], `${binding.id} is edit-only`)
}
assert.ok(
  submitBindings.some((binding) => binding.hotkey === 'Enter'),
  'specs submit includes Enter',
)
assert.ok(
  submitBindings.some((binding) => binding.hotkey === 'Mod+Enter'),
  'specs submit includes Mod+Enter',
)

console.log('keymap step and tab bindings ok')
