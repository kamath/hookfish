import { useEffect, useRef } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useHotkeys } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import {
  chromeAtom,
  enterCommand,
  getMode,
  modeAtom,
  protocolTraceOpenAtom,
  type Mode,
  type Pane,
} from './chrome'
import { blurActive, isEditing } from './focus'

export type PaneBinding = {
  id: string
  hotkey: RegisterableHotkey
  label: string
  modes?: readonly Mode[]
  flag?: string
}

export type PaneAction = {
  callback: (event: KeyboardEvent) => void
  enabled?: boolean
  ignoreInputs?: boolean
}

export type PaneConfig = {
  parent?: Pane
  path: string
  bindings: readonly PaneBinding[]
}

export const paneConfig: Record<Pane, PaneConfig> = {
  specs: {
    path: '/',
    bindings: [
      { id: 'open', hotkey: 'Enter', label: 'open' },
      { id: 'next', hotkey: 'J', label: 'next source', flag: 'hasSpecs' },
      { id: 'previous', hotkey: 'K', label: 'previous source', flag: 'hasSpecs' },
      {
        id: 'sourceType',
        hotkey: 'Mod+/',
        label: 'source type',
        modes: ['command', 'edit'],
      },
      { id: 'insert', hotkey: 'I', label: 'insert' },
      { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
    ],
  },
  routes: {
    parent: 'specs',
    path: '/apis/$apiId/routes',
    bindings: [
      { id: 'filter', hotkey: '/', label: 'filter' },
      { id: 'next', hotkey: 'J', label: 'next' },
      { id: 'previous', hotkey: 'K', label: 'previous' },
      { id: 'input', hotkey: 'Enter', label: 'input' },
      {
        id: 'clearAuth',
        hotkey: 'Mod+Backspace',
        label: 'clear auth',
        flag: 'canClear',
        modes: ['command', 'edit'],
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
    path: '/apis/$apiId/input/$operationId',
    bindings: [
      { id: 'next', hotkey: 'J', label: 'next control' },
      { id: 'previous', hotkey: 'K', label: 'previous control' },
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
      { id: 'export', hotkey: 'Y', label: 'copy code', flag: 'hasExport' },
      {
        id: 'send',
        hotkey: 'Mod+Enter',
        label: 'send',
        modes: ['command', 'edit'],
      },
      {
        id: 'clearAuth',
        hotkey: 'Mod+Backspace',
        label: 'clear auth',
        flag: 'canClear',
        modes: ['command', 'edit'],
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
      { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
    ],
  },
  response: {
    parent: 'input',
    path: '/apis/$apiId/response/$operationId',
    bindings: [
      { id: 'next', hotkey: 'J', label: 'next line' },
      { id: 'previous', hotkey: 'K', label: 'previous line' },
      { id: 'expand', hotkey: 'Enter', label: 'expand' },
      {
        id: 'resend',
        hotkey: 'Mod+Enter',
        label: 'resend',
        modes: ['command', 'edit'],
      },
      { id: 'details', hotkey: 'H', label: 'details', flag: 'hasDetails' },
      {
        id: 'children',
        hotkey: 'A',
        label: 'toggle children',
        flag: 'canToggleChildren',
      },
      { id: 'parent', hotkey: 'Escape', label: 'input' },
    ],
  },
}

const registeredPaneBindings = (Object.entries(paneConfig) as Array<[Pane, PaneConfig]>).flatMap(
  ([pane, config]) => config.bindings.map((binding) => ({ pane, binding })),
)
const noopKeybinding = () => {}

type Registration = {
  pane: Pane
  actions?: Partial<Record<string, PaneAction>>
  flags?: Record<string, boolean>
}

export function useShowKeybindings() {
  return useAtomValue(modeAtom) === 'command'
}

const registrationsAtom = atom(new Map<symbol, Registration>())
export const activeKeybindingsAtom = atom((get) => {
  if (get(protocolTraceOpenAtom)) {
    return []
  }
  const chrome = get(chromeAtom)
  const flags: Record<string, boolean> = {}
  for (const registration of get(registrationsAtom).values()) {
    if (registration.pane === chrome.pane) {
      Object.assign(flags, registration.flags)
    }
  }
  return paneConfig[chrome.pane].bindings.filter((binding) => {
    const modes = binding.modes ?? ['command']
    return modes.includes(chrome.mode) && (!binding.flag || Boolean(flags[binding.flag]))
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
  const chrome = useAtomValue(chromeAtom)
  const registrations = useAtomValue(registrationsAtom)
  const protocolTraceOpen = useAtomValue(protocolTraceOpenAtom)
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
    registeredPaneBindings.map(({ pane, binding }) => {
      const action = actions[binding.id]
      const modes = binding.modes ?? ['command']
      const flagOn = !binding.flag || Boolean(flags[binding.flag])
      return {
        hotkey: binding.hotkey,
        callback: action?.callback ?? noopKeybinding,
        options: {
          enabled:
            !protocolTraceOpen &&
            pane === chrome.pane &&
            Boolean(action) &&
            action?.enabled !== false &&
            flagOn &&
            modes.includes(chrome.mode),
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
  })
}

export function bindEnterMode() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
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
