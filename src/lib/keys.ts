import { useHotkeys } from '@tanstack/react-hotkeys'
import type { UseHotkeyDefinition } from '@tanstack/react-hotkeys'
import { useEffect, useRef } from 'react'
import { getMode, useChrome, type Mode, type Pane } from './mode'

let lastStepAt = 0
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

/** True only when the pointer itself moved, not when the list scrolled under it. */
export function consumePointerIntent() {
  const moved = pointerMoved
  pointerMoved = false
  return moved
}

/** One document listener. J/K move one step per key event; command mode only. */
export function useStepKeys(step: (delta: number) => void, enabled = true) {
  const stepRef = useRef(step)
  const enabledRef = useRef(enabled)
  stepRef.current = step
  enabledRef.current = enabled

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current || event.metaKey || event.ctrlKey || event.altKey) {
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
      lastStepAt = event.timeStamp
      pointerMoved = false
      event.preventDefault()
      event.stopImmediatePropagation()
      stepRef.current(key === 'j' ? 1 : -1)
    }
    document.addEventListener('keydown', onKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])
}

export function usePaneHotkeys(
  pane: Pane,
  modes: readonly Mode[],
  hotkeys: UseHotkeyDefinition[],
) {
  const chrome = useChrome()
  useHotkeys(hotkeys, {
    enabled: modes.includes(chrome.mode) && chrome.pane === pane,
  })
}

export function useEditHotkeys(hotkeys: UseHotkeyDefinition[]) {
  const { mode } = useChrome()
  useHotkeys(hotkeys, {
    enabled: mode === 'edit',
    ignoreInputs: false,
  })
}
