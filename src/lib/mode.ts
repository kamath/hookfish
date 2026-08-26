import { useSyncExternalStore } from 'react'
import { isEditing } from './focus'

export type Mode = 'command' | 'edit'
export type Pane = 'home' | 'list' | 'form' | 'auth'

type Chrome = {
  mode: Mode
  pane: Pane
}

const listeners = new Set<() => void>()
let chrome: Chrome = { mode: 'command', pane: 'home' }

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function setChrome(next: Chrome) {
  if (next.mode === chrome.mode && next.pane === chrome.pane) {
    return
  }
  chrome = next
  emit()
}

export function getMode() {
  return chrome.mode
}

export function getPane() {
  return chrome.pane
}

export function getChrome() {
  return chrome
}

export function subscribeChrome(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function activate(pane: Pane, mode: Mode = 'command') {
  setChrome({ pane, mode })
}

export function enterEdit() {
  setChrome({ pane: chrome.pane, mode: 'edit' })
}

export function enterCommand() {
  setChrome({ pane: chrome.pane, mode: 'command' })
}

export function useChrome() {
  return useSyncExternalStore(subscribeChrome, getChrome, getChrome)
}

export function isInsertMode() {
  return chrome.mode === 'edit'
}

export function setInsertMode(next: boolean) {
  if (next) {
    enterEdit()
    return
  }
  enterCommand()
}

export function subscribeFormMode(listener: () => void) {
  return subscribeChrome(listener)
}

export function paneForTarget(target: EventTarget | null): Pane | undefined {
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
  if (target.closest('#auth-form')) {
    return 'auth'
  }
  return undefined
}

export function bindModeFromFocus() {
  const onFocusIn = (event: FocusEvent) => {
    if (!isEditing()) {
      return
    }
    const pane = paneForTarget(event.target)
    if (pane) {
      activate(pane, 'edit')
      return
    }
    enterEdit()
  }
  document.addEventListener('focusin', onFocusIn)
  return () => document.removeEventListener('focusin', onFocusIn)
}
