import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { isEditing } from './focus'

export type Mode = 'command' | 'edit'
export type Pane = 'specs' | 'routes' | 'input' | 'response' | 'trace'

export const store = getDefaultStore()

export type Chrome = {
  mode: Mode
  pane: Pane
}

export const chromeAtom = atom<Chrome>({ mode: 'command', pane: 'specs' })
export const modeAtom = atom((get) => get(chromeAtom).mode)
export const paneAtom = atom((get) => get(chromeAtom).pane)

function syncDocumentMode(mode: Mode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.ocMode = mode
  }
}

export function getMode() {
  return store.get(chromeAtom).mode
}

export function getPane() {
  return store.get(chromeAtom).pane
}

export function getChrome(): Chrome {
  return store.get(chromeAtom)
}

export function setMode(mode: Mode) {
  if (getMode() === mode) {
    return
  }
  store.set(chromeAtom, (current) => ({ ...current, mode }))
  syncDocumentMode(mode)
}

export function setPane(pane: Pane) {
  if (getPane() === pane) {
    return
  }
  store.set(chromeAtom, (current) => ({ ...current, pane }))
}

export function activate(pane: Pane, mode: Mode = 'command') {
  const current = getChrome()
  if (current.pane === pane && current.mode === mode) {
    return
  }
  store.set(chromeAtom, { pane, mode })
  syncDocumentMode(mode)
}

export function enterEdit() {
  setMode('edit')
}

export function enterCommand() {
  setMode('command')
}

export function isInsertMode() {
  return getMode() === 'edit'
}

export function setInsertMode(next: boolean) {
  setMode(next ? 'edit' : 'command')
}

export function subscribeChrome(listener: () => void) {
  return store.sub(chromeAtom, listener)
}

export function subscribeFormMode(listener: () => void) {
  return subscribeChrome(listener)
}

export function useMode() {
  return useAtomValue(modeAtom)
}

export function usePane() {
  return useAtomValue(paneAtom)
}

export function useChrome(): Chrome {
  return useAtomValue(chromeAtom)
}

export function paneForTarget(target: EventTarget | null): Pane | undefined {
  if (!(target instanceof HTMLElement)) {
    return undefined
  }
  if (target.id === 'operation-filter') {
    return 'routes'
  }
  if (target.id === 'url') {
    return 'specs'
  }
  if (target.closest('#call-form')) {
    return 'input'
  }
  if (target.closest('#response-pane')) {
    return 'response'
  }
  if (target.closest('#protocol-trace-pane') || target.closest('[data-oc-trace-toggle]')) {
    return 'trace'
  }
  return undefined
}

function syncNearestFormMode(from: EventTarget | null) {
  if (!(from instanceof HTMLElement)) {
    return
  }
  const root = from.closest<HTMLElement>('[data-oc-mode]')
  if (root && root !== document.documentElement) {
    root.dataset.ocMode = getMode() === 'edit' ? 'insert' : 'command'
  }
}

export function bindModeFromFocus() {
  let restoreFrame = 0

  const cancelRestore = () => {
    if (!restoreFrame) {
      return
    }
    cancelAnimationFrame(restoreFrame)
    restoreFrame = 0
  }

  // Wait a frame so a programmatic blur-then-focus (insertCurrentInput) can
  // land first. focusin cancels this; a blur that goes nowhere restores command.
  const restoreCommandIfIdle = (from: EventTarget | null) => {
    cancelRestore()
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = 0
      if (isEditing()) {
        return
      }
      enterCommand()
      syncNearestFormMode(from)
    })
  }

  const onFocusIn = (event: FocusEvent) => {
    cancelRestore()
    const target = event.target
    const commandFocus =
      target instanceof HTMLElement &&
      target.closest('[data-oc-command-focus="true"]')
    if (commandFocus || !isEditing()) {
      const view = paneForTarget(target)
      if (view) {
        activate(view, 'command')
        return
      }
      enterCommand()
      return
    }
    const view = paneForTarget(target)
    if (view) {
      activate(view, 'edit')
      return
    }
    enterEdit()
  }

  const onFocusOut = (event: FocusEvent) => {
    restoreCommandIfIdle(event.target)
  }

  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  return () => {
    cancelRestore()
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
  }
}
