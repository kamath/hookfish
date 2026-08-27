import assert from 'node:assert/strict'
import {
  KEYBINDINGS_MEDIA,
  dialogAllowsBinding,
  hotkeysFor,
  isEscapeLike,
  keybindingsEnabled,
  paneConfig,
  previousPaneTitle,
} from './keymap.ts'

assert.deepEqual(hotkeysFor({ id: 'next', hotkey: 'J', label: 'next' }), ['J'])
assert.deepEqual(
  hotkeysFor({ id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next' }),
  ['J', 'ArrowDown'],
)
assert.deepEqual(
  hotkeysFor({ id: 'previous', hotkey: 'H', label: 'previous' }),
  ['H', 'ArrowLeft'],
)
assert.deepEqual(hotkeysFor({ id: 'next', hotkey: 'L', label: 'next' }), ['L', 'ArrowRight'])
assert.deepEqual(
  hotkeysFor({ id: 'edit', hotkey: 'H', label: 'edit', modes: ['edit'] }),
  ['H'],
  'arrow aliases only apply in command mode',
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

const specsRemove = paneConfig.specs.bindings.find((binding) => binding.id === 'remove')
assert.equal(specsRemove?.hotkey, 'D', 'specs remove is D')
assert.equal(specsRemove?.flag, 'hasSpecs', 'specs remove requires sources')
const confirmRemove = paneConfig.specs.bindings.find((binding) => binding.id === 'confirmRemove')
const cancelRemove = paneConfig.specs.bindings.find((binding) => binding.id === 'cancelRemove')
assert.equal(confirmRemove?.hotkey, 'Enter', 'confirm remove is Enter')
assert.equal(cancelRemove?.hotkey, 'Escape', 'cancel remove is Escape')
assert.ok(
  dialogAllowsBinding({ id: 'confirmRemove', hotkey: 'Enter', label: 'remove' }, { hasRemoveConfirm: true }),
  'remove confirm allows Enter',
)
assert.ok(
  dialogAllowsBinding({ id: 'cancelRemove', hotkey: 'Escape', label: 'cancel' }, { hasRemoveConfirm: true }),
  'remove confirm allows Escape',
)
assert.equal(
  dialogAllowsBinding({ id: 'open', hotkey: 'Enter', label: 'open' }, { hasRemoveConfirm: true }),
  false,
  'remove confirm blocks open',
)
assert.ok(
  dialogAllowsBinding({ id: 'open', hotkey: 'Enter', label: 'open' }, {}),
  'open is allowed without a dialog',
)
assert.equal(
  dialogAllowsBinding({ id: 'open', hotkey: 'Enter', label: 'open' }, { hasAuthRedirect: true }),
  false,
  'auth redirect blocks open',
)
assert.ok(
  dialogAllowsBinding(
    { id: 'continueAuth', hotkey: 'Enter', label: 'go now' },
    { hasAuthRedirect: true },
  ),
  'auth redirect allows go now',
)

for (const [pane, config] of Object.entries(paneConfig)) {
  for (const binding of config.bindings) {
    const modes = binding.modes ?? ['command']
    if (binding.hotkey !== 'Escape') {
      continue
    }
    if (modes.includes('command')) {
      assert.ok(
        hotkeysFor(binding).includes('Backspace'),
        `${pane} ${binding.id} Backspace matches Escape in command mode`,
      )
    } else {
      assert.equal(
        hotkeysFor(binding).includes('Backspace'),
        false,
        `${pane} ${binding.id} keeps Backspace for editing`,
      )
    }
  }
}

function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent
}

assert.equal(isEscapeLike(keyEvent('Escape')), true, 'Escape is escape-like')
assert.equal(isEscapeLike(keyEvent('Backspace')), true, 'Backspace is escape-like')
assert.equal(
  isEscapeLike(keyEvent('Backspace', { metaKey: true })),
  false,
  'Mod+Backspace is not escape-like',
)
assert.equal(
  isEscapeLike(keyEvent('Backspace', { ctrlKey: true })),
  false,
  'Ctrl+Backspace is not escape-like',
)
assert.equal(isEscapeLike(keyEvent('Enter')), false, 'Enter is not escape-like')

console.log('keymap step and tab bindings ok')

const labels = { sourcePlural: 'OpenAPI documents', executablePlural: 'Endpoints' }
assert.equal(previousPaneTitle('routes', labels), 'OpenAPI documents')
assert.equal(previousPaneTitle('input', labels), 'Endpoints')
assert.equal(previousPaneTitle('response', labels), 'Input')
assert.equal(previousPaneTitle('specs', labels), undefined)
console.log('keymap previous pane titles ok')

assert.equal(
  KEYBINDINGS_MEDIA,
  '(min-width: 768px) and (not (pointer: coarse))',
  'availability query matches the CSS hide dual',
)

const originalMatchMedia = globalThis.matchMedia

function withMatchMedia(matchesFor: (query: string) => boolean, run: () => void) {
  globalThis.matchMedia = ((query: string) =>
    ({
      matches: matchesFor(query),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
      onchange: null,
    })) as typeof matchMedia
  try {
    run()
  } finally {
    if (originalMatchMedia) {
      globalThis.matchMedia = originalMatchMedia
    } else {
      Reflect.deleteProperty(globalThis, 'matchMedia')
    }
  }
}

withMatchMedia(
  () => false,
  () => {
    assert.equal(keybindingsEnabled(), false, 'disabled when the media query does not match')
  },
)
withMatchMedia(
  (query) => query === KEYBINDINGS_MEDIA,
  () => {
    assert.equal(keybindingsEnabled(), true, 'enabled on md+ viewports that are not coarse-pointer')
  },
)
withMatchMedia(
  (query) => query !== KEYBINDINGS_MEDIA,
  () => {
    assert.equal(keybindingsEnabled(), false, 'disabled for other media queries')
  },
)

{
  const previous = globalThis.matchMedia
  Reflect.deleteProperty(globalThis, 'matchMedia')
  try {
    assert.equal(keybindingsEnabled(), false, 'disabled without matchMedia')
  } finally {
    if (previous) {
      globalThis.matchMedia = previous
    }
  }
}

console.log('keymap mobile availability ok')
