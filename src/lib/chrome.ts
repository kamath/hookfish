import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { isEditing } from './focus'

export type Mode = 'command' | 'edit'
export type Pane = 'specs' | 'routes' | 'input' | 'response'

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
  return undefined
}

export function bindModeFromFocus() {
  const onFocusIn = (event: FocusEvent) => {
    if (!isEditing()) {
      return
    }
    const view = paneForTarget(event.target)
    if (view) {
      activate(view, 'edit')
      return
    }
    enterEdit()
  }
  document.addEventListener('focusin', onFocusIn)
  return () => document.removeEventListener('focusin', onFocusIn)
}
