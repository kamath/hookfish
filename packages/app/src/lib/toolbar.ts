import { useLayoutEffect, useRef } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'

export type SourceToolbar = {
  title: string
  updatedAt?: string
  onRefresh?: () => void | Promise<void>
  refreshPending?: boolean
  refreshDisabled?: boolean
  refreshError?: unknown
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
  const updatedAt = toolbar.updatedAt
  const canRefresh = Boolean(toolbar.onRefresh)
  const refreshPending = Boolean(toolbar.refreshPending)
  const refreshDisabled = Boolean(toolbar.refreshDisabled)
  const canClear = Boolean(toolbar.onClearAuth)
  const authPending = Boolean(toolbar.authPending)
  const backLabel = toolbar.backLabel
  const hasBack = Boolean(toolbar.onBack)
  const refreshError = toolbar.refreshError

  useLayoutEffect(() => {
    setToolbar({
      title,
      updatedAt,
      refreshPending,
      refreshDisabled,
      refreshError,
      authPending,
      backLabel,
      onRefresh: canRefresh
        ? () => {
            void latest.current.onRefresh?.()
          }
        : undefined,
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
  }, [
    title,
    updatedAt,
    canRefresh,
    refreshPending,
    refreshDisabled,
    refreshError,
    canClear,
    authPending,
    backLabel,
    hasBack,
    setToolbar,
  ])
}

export function useSourceToolbarValue() {
  return useAtomValue(sourceToolbarAtom)
}
