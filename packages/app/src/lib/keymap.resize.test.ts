import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// Crossing the keybindings breakpoint must not change how many hooks a component
// runs, otherwise React mismatches the hook lists and blows up mid-resize with
// "Cannot read properties of undefined (reading 'length')".

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})

type MediaListener = (event: { matches: boolean; media: string }) => void

const listeners = new Map<string, Set<MediaListener>>()
let wide = true

function setWide(next: boolean) {
  wide = next
  for (const [media, set] of listeners) {
    for (const listener of set) {
      listener({ matches: wide, media })
    }
  }
}

dom.window.matchMedia = ((media: string) => ({
  get matches() {
    return wide
  },
  media,
  addEventListener(_type: string, listener: MediaListener) {
    const set = listeners.get(media) ?? new Set<MediaListener>()
    set.add(listener)
    listeners.set(media, set)
  },
  removeEventListener(_type: string, listener: MediaListener) {
    listeners.get(media)?.delete(listener)
  },
  addListener() {},
  removeListener() {},
  dispatchEvent() {
    return false
  },
  onchange: null,
})) as unknown as typeof window.matchMedia

const globals = globalThis as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
Object.defineProperty(globals, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
})
globals.matchMedia = dom.window.matchMedia
globals.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globals.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globals.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement, useMemo, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { enterCommand, enterEdit } = await import('./chrome.ts')
const { useShowKeybindings } = await import('./keymap.ts')

let rendered: boolean | undefined
let label: string | undefined

// Mirrors the shape of the home page: `useShowKeybindings` sits in the middle of
// the hook list, so a hook-count change there shifts every hook after it.
function Probe() {
  const [suffix] = useState('!')
  const show = useShowKeybindings()
  const computed = useMemo(() => `show:${show}${suffix}`, [show, suffix])
  rendered = show
  label = computed
  return null
}

const container = dom.window.document.createElement('div')
dom.window.document.body.append(container)
const root = createRoot(container)

enterCommand()
await act(async () => {
  root.render(createElement(Probe))
})
assert.equal(rendered, true, 'keybindings show on a wide viewport in command mode')
assert.equal(label, 'show:true!')

// Narrow the viewport: this is the resize that used to crash.
await act(async () => {
  setWide(false)
})
assert.equal(rendered, false, 'keybindings hide once the viewport narrows')
assert.equal(label, 'show:false!', 'hooks after useShowKeybindings keep their state')

// ...and back again.
await act(async () => {
  setWide(true)
})
assert.equal(rendered, true, 'keybindings come back when the viewport widens')
assert.equal(label, 'show:true!')

// Mode changes still propagate on both sides of the breakpoint.
await act(async () => {
  enterEdit()
})
assert.equal(rendered, false, 'edit mode hides keybindings')

await act(async () => {
  setWide(false)
})
await act(async () => {
  enterCommand()
})
assert.equal(rendered, false, 'command mode alone does not show keybindings when narrow')

await act(async () => {
  root.unmount()
})

console.log('keymap resize ok')
