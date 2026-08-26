import { useEffect, useRef } from 'react'
import { isEditing } from './focus'

/** Always hear the key, even after focus moved into a field. Decide in the callback. */
export const commandHotkey = {
  ignoreInputs: false,
  preventDefault: false,
  requireReset: true,
} as const

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

/** One document listener. J/K move one step per key event; ignored while typing. */
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
      if (isEditing()) {
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
