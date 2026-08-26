import { useEffect, useRef } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useHotkeys } from '@tanstack/react-hotkeys'
import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import { getMode, getView, modeAtom, store, viewAtom, type Mode, type View } from './chrome'

export type ViewBinding = {
  id: string
  hotkey: RegisterableHotkey
  label: string
  modes?: readonly Mode[]
  flag?: string
}

export type ViewAction = {
  callback: (event: KeyboardEvent) => void
  enabled?: boolean
  ignoreInputs?: boolean
}

export const viewKeymaps: Record<View, readonly ViewBinding[]> = {
  home: [
    { id: 'open', hotkey: 'Enter', label: 'open' },
    { id: 'next', hotkey: 'J', label: 'next spec', flag: 'hasSpecs' },
    { id: 'previous', hotkey: 'K', label: 'previous spec', flag: 'hasSpecs' },
    { id: 'insert', hotkey: 'I', label: 'insert' },
    { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
  ],
  list: [
    { id: 'filter', hotkey: '/', label: 'filter' },
    { id: 'next', hotkey: 'J', label: 'next' },
    { id: 'previous', hotkey: 'K', label: 'previous' },
    { id: 'fields', hotkey: 'Enter', label: 'fields' },
    {
      id: 'clearAuth',
      hotkey: 'Mod+Backspace',
      label: 'clear auth',
      flag: 'canClear',
      modes: ['command', 'edit'],
    },
    { id: 'escape', hotkey: 'Escape', label: 'specs', flag: 'noFilter' },
    { id: 'clearEscape', hotkey: 'Escape', label: 'clear filter', flag: 'hasFilter' },
    { id: 'prevServer', hotkey: '[', label: 'previous server', flag: 'manyServers' },
    { id: 'nextServer', hotkey: ']', label: 'next server', flag: 'manyServers' },
    { id: 'confirmFilter', hotkey: 'Enter', label: 'open', modes: ['edit'] },
    { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
  ],
  form: [
    { id: 'previousRoute', hotkey: 'H', label: 'previous route', flag: 'canPreviousRoute' },
    { id: 'nextRoute', hotkey: 'L', label: 'next route', flag: 'canNextRoute' },
    { id: 'copyFetch', hotkey: 'Y', label: 'copy fetch' },
    { id: 'send', hotkey: 'Mod+Enter', label: 'send', modes: ['command', 'edit'] },
    {
      id: 'clearAuth',
      hotkey: 'Mod+Backspace',
      label: 'clear auth',
      flag: 'canClear',
      modes: ['command', 'edit'],
    },
    { id: 'operations', hotkey: 'Escape', label: 'operations' },
    { id: 'prevServer', hotkey: '[', label: 'previous server', flag: 'manyServers' },
    { id: 'nextServer', hotkey: ']', label: 'next server', flag: 'manyServers' },
    { id: 'output', hotkey: 'O', label: 'output', flag: 'hasResult' },
    { id: 'command', hotkey: 'Escape', label: 'command', modes: ['edit'] },
  ],
  response: [
    { id: 'next', hotkey: 'J', label: 'next line' },
    { id: 'previous', hotkey: 'K', label: 'previous line' },
    { id: 'expand', hotkey: 'Enter', label: 'expand' },
    { id: 'resend', hotkey: 'Mod+Enter', label: 'resend', modes: ['command', 'edit'] },
    { id: 'headers', hotkey: 'H', label: 'headers', flag: 'hasHeaders' },
    { id: 'children', hotkey: 'A', label: 'toggle children', flag: 'canToggleChildren' },
    { id: 'request', hotkey: 'Escape', label: 'request' },
  ],
}

export type ViewFlags = Partial<Record<View, Record<string, boolean>>>

export const viewFlagsAtom = atom<ViewFlags>({})

export function useShowKeybindings() {
  return useAtomValue(modeAtom) === 'command'
}

export function useViewFlags(view: View, flags: Record<string, boolean>) {
  const setFlags = useSetAtom(viewFlagsAtom)
  const serialized = JSON.stringify(flags)

  useEffect(() => {
    const parsed = JSON.parse(serialized) as Record<string, boolean>
    setFlags((previous) => ({
      ...previous,
      [view]: { ...previous[view], ...parsed },
    }))
    return () => {
      const owned = Object.keys(parsed)
      setFlags((previous) => {
        const current = { ...previous[view] }
        for (const key of owned) {
          delete current[key]
        }
        return { ...previous, [view]: current }
      })
    }
  }, [view, serialized, setFlags])
}

export function useViewActions(
  view: View,
  actions: Partial<Record<string, ViewAction | ((event: KeyboardEvent) => void)>>,
) {
  const mode = useAtomValue(modeAtom)
  const currentView = useAtomValue(viewAtom)
  const flags = useAtomValue(viewFlagsAtom)[view] ?? {}

  useHotkeys(
    viewKeymaps[view].flatMap((binding) => {
      const action = actions[binding.id]
      if (!action) {
        return []
      }
      const spec = typeof action === 'function' ? { callback: action } : action
      const modes = binding.modes ?? ['command']
      const flagOn = !binding.flag || Boolean(flags[binding.flag])
      return [
        {
          hotkey: binding.hotkey,
          callback: spec.callback,
          options: {
            enabled:
              spec.enabled !== false &&
              flagOn &&
              modes.includes(mode) &&
              currentView === view,
            ignoreInputs: spec.ignoreInputs ?? !modes.includes('edit'),
          },
        },
      ]
    }),
  )
}

type StepHandler = (delta: number) => void

export const viewStepsAtom = atom<Partial<Record<View, StepHandler>>>({})

export function useViewStep(view: View, step: StepHandler, enabled = true) {
  const setSteps = useSetAtom(viewStepsAtom)
  const stepRef = useRef(step)
  stepRef.current = step

  useEffect(() => {
    if (!enabled) {
      setSteps((previous) => {
        if (!previous[view]) {
          return previous
        }
        const next = { ...previous }
        delete next[view]
        return next
      })
      return
    }

    const handler: StepHandler = (delta) => stepRef.current(delta)
    setSteps((previous) => ({ ...previous, [view]: handler }))
    return () => {
      setSteps((previous) => {
        if (previous[view] !== handler) {
          return previous
        }
        const next = { ...previous }
        delete next[view]
        return next
      })
    }
  }, [view, enabled, setSteps])
}

let lastStepAt = 0

export function bindStepKeys() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }
    if (getMode() !== 'command') {
      return
    }
    const key = event.key.toLowerCase()
    if (key !== 'j' && key !== 'k') {
      return
    }
    if (event.timeStamp === lastStepAt) {
      return
    }
    const step = store.get(viewStepsAtom)[getView()]
    if (!step) {
      return
    }
    lastStepAt = event.timeStamp
    consumePointerIntent()
    event.preventDefault()
    event.stopImmediatePropagation()
    step(key === 'j' ? 1 : -1)
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
