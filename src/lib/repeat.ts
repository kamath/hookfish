import { useCallback, useEffect, useRef } from 'react'

export const repeatHotkey = { requireReset: false } as const

export function useRepeatDelta(apply: (delta: number) => void) {
  const applyRef = useRef(apply)
  applyRef.current = apply
  const pending = useRef(0)
  const frame = useRef(0)

  useEffect(
    () => () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current)
      }
    },
    [],
  )

  return useCallback((delta: number) => {
    pending.current += delta
    if (frame.current) {
      return
    }
    frame.current = requestAnimationFrame(() => {
      const step = pending.current
      pending.current = 0
      frame.current = 0
      if (step !== 0) {
        applyRef.current(step)
      }
    })
  }, [])
}

export function useTrailingCommit<T>(commit: (value: T) => void, delay = 80) {
  const commitRef = useRef(commit)
  commitRef.current = commit
  const valueRef = useRef<T | undefined>(undefined)
  const timer = useRef(0)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = 0
    if (valueRef.current !== undefined) {
      const value = valueRef.current
      valueRef.current = undefined
      commitRef.current(value)
    }
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const set = useCallback(
    (value: T) => {
      valueRef.current = value
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    [delay, flush],
  )

  return { set, flush }
}
