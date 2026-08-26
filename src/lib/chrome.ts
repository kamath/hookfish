import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { isEditing } from './focus'

export type Mode = 'command' | 'edit'
export type View = 'home' | 'list' | 'form' | 'response'
export type Pane = View

export const store = getDefaultStore()

export const modeAtom = atom<Mode>('command')
export const viewAtom = atom<View>('home')

export type Chrome = {
  mode: Mode
  view: View
  pane: View
}

export function getMode() {
  return store.get(modeAtom)
}

export function getView() {
  return store.get(viewAtom)
}

export function getPane() {
  return getView()
}

export function getChrome(): Chrome {
  const view = getView()
  return { mode: getMode(), view, pane: view }
}

export function setMode(mode: Mode) {
  if (getMode() === mode) {
    return
  }
  store.set(modeAtom, mode)
}

export function setView(view: View) {
  if (getView() === view) {
    return
  }
  store.set(viewAtom, view)
}

export function activate(view: View, mode: Mode = 'command') {
  setView(view)
  setMode(mode)
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
  const unsubMode = store.sub(modeAtom, listener)
  const unsubView = store.sub(viewAtom, listener)
  return () => {
    unsubMode()
    unsubView()
  }
}

export function subscribeFormMode(listener: () => void) {
  return subscribeChrome(listener)
}

export function useMode() {
  return useAtomValue(modeAtom)
}

export function useView() {
  return useAtomValue(viewAtom)
}

export function useChrome(): Chrome {
  const mode = useMode()
  const view = useView()
  return { mode, view, pane: view }
}

export function paneForTarget(target: EventTarget | null): View | undefined {
  if (!(target instanceof HTMLElement)) {
    return undefined
  }
  if (target.id === 'operation-filter') {
    return 'list'
  }
  if (target.id === 'url') {
    return 'home'
  }
  if (target.closest('#call-form')) {
    return 'form'
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
