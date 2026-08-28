import { useLayoutEffect, useRef } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'

export type SourceToolbar = {
  title: string
  onClearAuth?: () => void | Promise<void>
  authPending?: boolean
  backLabel?: string
  onBack?: () => void
}

export const sourceToolbarAtom = atom<SourceToolbar | null>(null)

export function useSourceToolbar(toolbar: SourceToolbar) {
  const setToolbar = useSetAtom(sourceToolbarAtom)
  const latest = useRef(toolbar)
  latest.current = toolbar

  const title = toolbar.title
  const canClear = Boolean(toolbar.onClearAuth)
  const authPending = Boolean(toolbar.authPending)
  const backLabel = toolbar.backLabel
  const hasBack = Boolean(toolbar.onBack)

  useLayoutEffect(() => {
    setToolbar({
      title,
      authPending,
      backLabel,
      onClearAuth: canClear
        ? () => {
            void latest.current.onClearAuth?.()
          }
        : undefined,
      onBack: hasBack
        ? () => {
            latest.current.onBack?.()
          }
        : undefined,
    })
    return () => setToolbar(null)
  }, [title, canClear, authPending, backLabel, hasBack, setToolbar])
}

export function useSourceToolbarValue() {
  return useAtomValue(sourceToolbarAtom)
}
