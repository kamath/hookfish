import { useEffect, useRef, useSyncExternalStore } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useHotkeys } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import {
  chromeAtom,
  enterCommand,
  getMode,
  modeAtom,
  type Mode,
  type Pane,
} from './chrome'
import { carouselActionId } from './catalog'
import { blurActive, isEditing } from './focus'

export type PaneBinding = {
  id: string
  hotkey: RegisterableHotkey
  aliases?: readonly RegisterableHotkey[]
  label: string
  modes?: readonly Mode[]
  flag?: string
}

export function isEscapeLike(event: KeyboardEvent) {
  return (
    event.key === 'Escape' ||
    (event.key === 'Backspace' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey)
  )
}

export function hotkeysFor(binding: PaneBinding): RegisterableHotkey[] {
  const keys: RegisterableHotkey[] = [binding.hotkey, ...(binding.aliases ?? [])]
  const modes = binding.modes ?? ['command']
  // Command-mode Escape also binds Backspace. Edit-only Escape stays insert-exit.
  if (binding.hotkey === 'Escape' && modes.includes('command') && !keys.includes('Backspace')) {
    keys.push('Backspace')
  }
  // Command-mode horizontal movement also supports the matching arrow keys.
  if (modes.includes('command')) {
    const arrow = binding.hotkey === 'H' ? 'ArrowLeft' : binding.hotkey === 'L' ? 'ArrowRight' : undefined
    if (arrow && !keys.includes(arrow)) {
      keys.push(arrow)
    }
  }
  return keys
}

export function modesForHotkey(
  binding: PaneBinding,
  hotkey: RegisterableHotkey = binding.hotkey,
): readonly Mode[] {
  const usesMod =
    typeof hotkey === 'string' ? hotkey.split('+').includes('Mod') : hotkey.mod === true
  return usesMod
    ? ['command', 'edit']
    : (binding.modes ?? ['command'])
}

export type PaneAction = {
  callback: (event: KeyboardEvent) => void
  enabled?: boolean
  ignoreInputs?: boolean
}

export type PaneConfig = {
  parent?: Pane
  path: string
  title?: string
  bindings: readonly PaneBinding[]
}

export const paneConfig: Record<Pane, PaneConfig> = {
  specs: {
    path: '/',
    bindings: [
      { id: 'open', hotkey: 'Enter', label: 'open item', flag: 'hasCarousel' },
      { id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next item', flag: 'hasCarousel' },
      { id: 'previous', hotkey: 'K', aliases: ['ArrowUp'], label: 'previous item', flag: 'hasCarousel' },
      { id: 'carouselPrevious', hotkey: 'H', label: 'previous list', flag: 'hasCarousel' },
      { id: 'carouselNext', hotkey: 'L', label: 'next list', flag: 'hasCarousel' },
      { id: 'insert', hotkey: 'I', label: 'insert' },
      { id: 'signIn', hotkey: 'S', label: 'sign in', flag: 'signedOut' },
      ...(['1', '2', '3', '4', '5'] as const).map((hotkey, index) => ({
        id: carouselActionId(index),
        hotkey,
        label: `open item ${hotkey}`,
        flag: 'hasCarousel',
      })),
      {
        id: 'continueAuth',
        hotkey: 'Enter',
        label: 'go now',
        flag: 'hasAuthRedirect',
        modes: ['command', 'edit'],
      },
      {
        id: 'cancelAuth',
        hotkey: 'Escape',
        label: 'cancel',
        flag: 'hasAuthRedirect',
        modes: ['command', 'edit'],
      },
      { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
    ],
  },
  login: {
    parent: 'specs',
    path: '/login',
    title: 'Sign in',
    bindings: [
      { id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next field' },
      { id: 'previous', hotkey: 'K', aliases: ['ArrowUp'], label: 'previous field' },
      { id: 'nextTab', hotkey: 'Tab', label: 'next field' },
      { id: 'previousTab', hotkey: 'Shift+Tab', label: 'previous field' },
      { id: 'insert', hotkey: 'I', label: 'edit', flag: 'canEdit' },
      {
        id: 'submitNow',
        hotkey: 'Enter',
        label: 'submit',
        flag: 'canEdit',
      },
      { id: 'switchAuthMode', hotkey: 'C', label: 'switch form', flag: 'canEdit' },
      { id: 'continue', hotkey: 'Enter', label: 'continue', flag: 'signedIn' },
      { id: 'parent', hotkey: 'Escape', label: 'sources' },
      { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
    ],
  },
  routes: {
    parent: 'specs',
    path: '/apis/$apiId/routes',
    bindings: [
      { id: 'filter', hotkey: '/', label: 'filter' },
      { id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next' },
      { id: 'previous', hotkey: 'K', aliases: ['ArrowUp'], label: 'previous' },
      { id: 'nextTab', hotkey: 'Tab', label: 'next' },
      { id: 'previousTab', hotkey: 'Shift+Tab', label: 'previous' },
      { id: 'input', hotkey: 'Enter', label: 'input' },
      { id: 'trace', hotkey: 'T', label: 'trace', flag: 'hasTrace' },
      {
        id: 'clearAuth',
        hotkey: 'Mod+Backspace',
        label: 'clear auth',
        flag: 'canClear',
      },
      { id: 'parent', hotkey: 'Escape', label: 'sources' },
      {
        id: 'prevServer',
        hotkey: '[',
        label: 'previous target',
        flag: 'manyServers',
      },
      {
        id: 'nextServer',
        hotkey: ']',
        label: 'next target',
        flag: 'manyServers',
      },
      { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
    ],
  },
  input: {
    parent: 'routes',
    title: 'Input',
    path: '/apis/$apiId/input/$operationId',
    bindings: [
      { id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next control' },
      { id: 'previous', hotkey: 'K', aliases: ['ArrowUp'], label: 'previous control' },
      { id: 'nextTab', hotkey: 'Tab', label: 'next control' },
      { id: 'previousTab', hotkey: 'Shift+Tab', label: 'previous control' },
      {
        id: 'previousRoute',
        hotkey: 'H',
        label: 'previous executable',
        flag: 'canPreviousRoute',
      },
      {
        id: 'nextRoute',
        hotkey: 'L',
        label: 'next executable',
        flag: 'canNextRoute',
      },
      { id: 'expand', hotkey: 'Enter', label: 'edit' },
      { id: 'insert', hotkey: 'I', label: 'edit' },
      { id: 'inspect', hotkey: 'V', label: 'inspect' },
      { id: 'description', hotkey: 'E', label: 'expand description', flag: 'hasDescription' },
      { id: 'export', hotkey: 'Y', label: 'copy code', flag: 'hasExport' },
      { id: 'copy', hotkey: 'Y', label: 'copy JSON', flag: 'hasJson' },
      { id: 'children', hotkey: 'A', label: 'toggle children', flag: 'canToggleChildren' },
      {
        id: 'send',
        hotkey: 'Mod+Enter',
        label: 'send',
      },
      {
        id: 'clearAuth',
        hotkey: 'Mod+Backspace',
        label: 'clear auth',
        flag: 'canClear',
      },
      { id: 'parent', hotkey: 'Escape', label: 'executables' },
      {
        id: 'prevServer',
        hotkey: '[',
        label: 'previous target',
        flag: 'manyServers',
      },
      {
        id: 'nextServer',
        hotkey: ']',
        label: 'next target',
        flag: 'manyServers',
      },
      { id: 'output', hotkey: 'O', label: 'output', flag: 'hasResult' },
      { id: 'trace', hotkey: 'T', label: 'trace', flag: 'hasTrace' },
      { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
    ],
  },
  response: {
    parent: 'input',
    path: '/apis/$apiId/response/$operationId',
    bindings: [
      { id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next line' },
      { id: 'previous', hotkey: 'K', aliases: ['ArrowUp'], label: 'previous line' },
      { id: 'expand', hotkey: 'Enter', label: 'expand' },
      { id: 'copy', hotkey: 'Y', label: 'copy JSON', flag: 'hasJson' },
      {
        id: 'clearAuth',
        hotkey: 'Mod+Backspace',
        label: 'clear auth',
        flag: 'canClear',
      },
      {
        id: 'resend',
        hotkey: 'Mod+Enter',
        label: 'resend',
      },
      { id: 'details', hotkey: 'H', label: 'details', flag: 'hasDetails' },
      {
        id: 'children',
        hotkey: 'A',
        label: 'toggle children',
        flag: 'canToggleChildren',
      },
      { id: 'parent', hotkey: 'Escape', label: 'input' },
      { id: 'trace', hotkey: 'T', label: 'trace', flag: 'hasTrace' },
    ],
  },
  trace: {
    parent: 'routes',
    path: '/apis/$apiId/trace',
    bindings: [
      { id: 'next', hotkey: 'J', aliases: ['ArrowDown'], label: 'next rpc' },
      { id: 'previous', hotkey: 'K', aliases: ['ArrowUp'], label: 'previous rpc' },
      { id: 'expand', hotkey: 'Enter', label: 'expand' },
      { id: 'trace', hotkey: 'T', label: 'close' },
      {
        id: 'clearAuth',
        hotkey: 'Mod+Backspace',
        label: 'clear auth',
        flag: 'canClear',
      },
      { id: 'parent', hotkey: 'Escape', label: 'close' },
    ],
  },
}

export function paneTitle(
  pane: Pane,
  labels: { sourcePlural: string; executablePlural: string },
) {
  const title = paneConfig[pane].title
  if (title) {
    return title
  }
  if (pane === 'routes') {
    return labels.executablePlural
  }
  return labels.sourcePlural
}

export function previousPaneTitle(
  pane: Pane,
  labels: { sourcePlural: string; executablePlural: string },
) {
  const parent = paneConfig[pane].parent
  if (!parent) {
    return undefined
  }
  return paneTitle(parent, labels)
}

const dialogBindings: Record<string, ReadonlySet<string>> = {
  hasAuthRedirect: new Set(['continueAuth', 'cancelAuth']),
}

export function dialogAllowsBinding(binding: PaneBinding, flags: Record<string, boolean>) {
  for (const [flag, allowed] of Object.entries(dialogBindings)) {
    if (flags[flag]) {
      return allowed.has(binding.id)
    }
  }
  return true
}

const registeredPaneBindings = (Object.entries(paneConfig) as Array<[Pane, PaneConfig]>).flatMap(
  ([pane, config]) =>
    config.bindings.flatMap((binding) =>
      hotkeysFor(binding).map((hotkey) => ({ pane, binding, hotkey })),
    ),
)
const noopKeybinding = () => {}

type Registration = {
  pane: Pane
  actions?: Partial<Record<string, PaneAction>>
  flags?: Record<string, boolean>
}

// Keep in sync with the `@media (pointer: coarse), (max-width: 767px)` hide in styles.css.
export const KEYBINDINGS_MEDIA = '(min-width: 768px) and (not (pointer: coarse))'

export function keybindingsEnabled() {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(KEYBINDINGS_MEDIA).matches
}

function subscribeKeybindingsEnabled(onChange: () => void) {
  if (typeof globalThis.matchMedia !== 'function') {
    return () => {}
  }
  const media = globalThis.matchMedia(KEYBINDINGS_MEDIA)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useKeybindingsEnabled() {
  return useSyncExternalStore(subscribeKeybindingsEnabled, keybindingsEnabled, () => false)
}

export function useShowKeybindings() {
  const enabled = useKeybindingsEnabled()
  return enabled && useAtomValue(modeAtom) === 'command'
}

const registrationsAtom = atom(new Map<symbol, Registration>())
export const activeKeybindingsAtom = atom((get) => {
  const chrome = get(chromeAtom)
  const flags: Record<string, boolean> = {}
  for (const registration of get(registrationsAtom).values()) {
    if (registration.pane === chrome.pane) {
      Object.assign(flags, registration.flags)
    }
  }
  return paneConfig[chrome.pane].bindings.filter((binding) => {
    const modes = modesForHotkey(binding)
    return (
      modes.includes(chrome.mode) &&
      (!binding.flag || Boolean(flags[binding.flag])) &&
      dialogAllowsBinding(binding, flags)
    )
  })
})

function useRegistration(registration: Registration) {
  const setRegistrations = useSetAtom(registrationsAtom)
  const id = useRef(Symbol('pane-registration'))
  const current = useRef(registration)
  current.current = registration
  const actionKeys = Object.keys(registration.actions ?? {})
    .sort()
    .join('|')
  const actionState = JSON.stringify(
    Object.fromEntries(
      Object.entries(registration.actions ?? {}).map(([key, action]) => [
        key,
        { enabled: action?.enabled, ignoreInputs: action?.ignoreInputs },
      ]),
    ),
  )
  const serialized = JSON.stringify(registration.flags ?? {})

  useEffect(() => {
    const actions = Object.fromEntries(
      actionKeys
        .split('|')
        .filter(Boolean)
        .map((key) => [
          key,
          {
            callback: (event: KeyboardEvent) => current.current.actions?.[key]?.callback(event),
            get enabled() {
              return current.current.actions?.[key]?.enabled
            },
            get ignoreInputs() {
              return current.current.actions?.[key]?.ignoreInputs
            },
          },
        ]),
    ) as Partial<Record<string, PaneAction>>
    const next: Registration = {
      pane: registration.pane,
      actions,
      flags: registration.flags ? (JSON.parse(serialized) as Record<string, boolean>) : undefined,
    }
    setRegistrations((previous) => new Map(previous).set(id.current, next))
    return () => {
      setRegistrations((previous) => {
        const nextRegistrations = new Map(previous)
        nextRegistrations.delete(id.current)
        return nextRegistrations
      })
    }
  }, [registration.pane, actionKeys, actionState, serialized, setRegistrations])
}

export function usePaneFlags(pane: Pane, flags: Record<string, boolean>) {
  useRegistration({ pane, flags })
}

export function usePaneActions(
  pane: Pane,
  actions: Partial<Record<string, PaneAction | ((event: KeyboardEvent) => void)>>,
) {
  const normalized = Object.fromEntries(
    Object.entries(actions).map(([id, action]) => [
      id,
      typeof action === 'function' ? { callback: action } : action,
    ]),
  ) as Partial<Record<string, PaneAction>>
  useRegistration({ pane, actions: normalized })
}

export function useGlobalKeybindings() {
  const keybindingsOn = useKeybindingsEnabled()
  const chrome = useAtomValue(chromeAtom)
  const registrations = useAtomValue(registrationsAtom)
  const actions: Partial<Record<string, PaneAction>> = {}
  const flags: Record<string, boolean> = {}
  for (const registration of registrations.values()) {
    if (registration.pane !== chrome.pane) {
      continue
    }
    Object.assign(actions, registration.actions)
    Object.assign(flags, registration.flags)
  }

  useHotkeys(
    registeredPaneBindings.map(({ pane, binding, hotkey }) => {
      const action = actions[binding.id]
      const modes = modesForHotkey(binding, hotkey)
      const flagOn = !binding.flag || Boolean(flags[binding.flag])
      return {
        hotkey,
        callback: action?.callback ?? noopKeybinding,
        options: {
          enabled:
            keybindingsOn &&
            pane === chrome.pane &&
            Boolean(action) &&
            action?.enabled !== false &&
            flagOn &&
            modes.includes(chrome.mode) &&
            dialogAllowsBinding(binding, flags),
          ignoreInputs: action?.ignoreInputs ?? !modes.includes('edit'),
        },
      }
    }),
  )
}

export function usePaneStep(pane: Pane, step: (delta: number) => void, enabled = true) {
  usePaneActions(pane, {
    next: { callback: () => step(1), enabled },
    previous: { callback: () => step(-1), enabled },
    nextTab: { callback: () => step(1), enabled, ignoreInputs: false },
    previousTab: { callback: () => step(-1), enabled, ignoreInputs: false },
  })
}

export function bindEnterMode() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      !keybindingsEnabled() ||
      event.key !== 'Enter' ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      getMode() !== 'edit' ||
      !isEditing()
    ) {
      return
    }
    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest('form[data-oc-enter-submit="true"]')
    ) {
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      const root = active.closest<HTMLElement>('[data-oc-mode]')
      if (root) {
        root.dataset.ocMode = 'command'
      }
    }
    blurActive()
    enterCommand()
  }
  document.addEventListener('keydown', onKeyDown, { capture: true })
  return () => document.removeEventListener('keydown', onKeyDown, { capture: true })
}

let pointerX = Number.NaN
let pointerY = Number.NaN
let pointerMoved = false

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.clientX === pointerX && event.clientY === pointerY) {
        return
      }
      pointerX = event.clientX
      pointerY = event.clientY
      pointerMoved = true
    },
    { passive: true },
  )
}

export function consumePointerIntent() {
  const moved = pointerMoved
  pointerMoved = false
  return moved
}
