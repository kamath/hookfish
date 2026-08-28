import assert from 'node:assert/strict'
import { bindModeFromFocus, enterEdit, getMode, setMode } from './chrome.ts'

type Listener = (event: { target: FakeElement | null; relatedTarget: FakeElement | null }) => void

class FakeElement {
  id = ''
  type = ''
  isContentEditable = false
  dataset: Record<string, string> = {}
  closest(_selector: string): FakeElement | null {
    return null
  }
}

class FakeInput extends FakeElement {
  type = 'text'
}

const listeners = new Map<string, Listener[]>()
const fakeRoot = new FakeElement()
const fakeDocument = {
  documentElement: fakeRoot,
  activeElement: null as FakeElement | null,
  addEventListener(type: string, listener: Listener) {
    listeners.set(type, [...(listeners.get(type) ?? []), listener])
  },
  removeEventListener(type: string, listener: Listener) {
    listeners.set(
      type,
      (listeners.get(type) ?? []).filter((item) => item !== listener),
    )
  },
}

Object.defineProperty(globalThis, 'HTMLElement', { value: FakeElement, configurable: true })
Object.defineProperty(globalThis, 'HTMLInputElement', { value: FakeInput, configurable: true })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: class FakeTextArea extends FakeElement {}, configurable: true })
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: class FakeSelect extends FakeElement {}, configurable: true })
Object.defineProperty(globalThis, 'document', { value: fakeDocument, configurable: true })

const frames: Array<(time: number) => void> = []
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (callback: (time: number) => void) => {
    frames.push(callback)
    return frames.length
  },
  configurable: true,
})
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: (handle: number) => {
    frames[handle - 1] = () => {}
  },
  configurable: true,
})

function flushFrames() {
  const pending = frames.splice(0, frames.length)
  for (const frame of pending) {
    frame(0)
  }
}

function dispatch(type: string, event: { target: FakeElement | null; relatedTarget?: FakeElement | null }) {
  for (const listener of listeners.get(type) ?? []) {
    listener({ target: event.target, relatedTarget: event.relatedTarget ?? null })
  }
}

const unbind = bindModeFromFocus()

setMode('edit')
assert.equal(getMode(), 'edit')
fakeDocument.activeElement = null
dispatch('focusout', { target: new FakeInput() })
assert.equal(getMode(), 'edit', 'command mode waits a frame so blur-then-focus can land')
flushFrames()
assert.equal(getMode(), 'command', 'blurring an input without a new editor restores command mode')

setMode('edit')
const field = new FakeInput()
fakeDocument.activeElement = field
dispatch('focusout', { target: field })
dispatch('focusin', { target: field })
flushFrames()
assert.equal(getMode(), 'edit', 'focus moving to another editor cancels the command restore')

setMode('edit')
fakeDocument.activeElement = null
const form = new FakeElement()
form.dataset.ocMode = 'insert'
const input = new FakeInput()
input.closest = (selector: string) => (selector === '[data-oc-mode]' ? form : null)
dispatch('focusout', { target: input })
flushFrames()
assert.equal(getMode(), 'command')
assert.equal(form.dataset.ocMode, 'command', 'the nearest form mode follows command restore')

enterEdit()
unbind()
fakeDocument.activeElement = null
dispatch('focusout', { target: new FakeInput() })
flushFrames()
assert.equal(getMode(), 'edit', 'unbind removes the focusout listener')

console.log('chrome focus blur restores command mode ok')
