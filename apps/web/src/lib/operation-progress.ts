import { useCallback } from 'react'
import { atom, useAtom } from 'jotai'
import type { ExecutionResult } from './client-types'

export type OperationProgress = {
  formData: unknown
  lastSubmission: unknown
  lastInvocation?: unknown
  result: ExecutionResult | null
  askingAuth: boolean
}

const emptyProgress: OperationProgress = {
  formData: {},
  lastSubmission: {},
  result: null,
  askingAuth: false,
}

const operationProgressAtom = atom(new Map<string, OperationProgress>())

export function useOperationProgress(apiId: string, operationId: string) {
  const key = `${apiId}\u0000${operationId}`
  const [progressByOperation, setProgressByOperation] = useAtom(operationProgressAtom)
  const progress = progressByOperation.get(key) ?? emptyProgress
  const updateProgress = useCallback(
    (patch: Partial<OperationProgress>) => {
      setProgressByOperation((current) => {
        const currentProgress = current.get(key) ?? emptyProgress
        return new Map(current).set(key, { ...currentProgress, ...patch })
      })
    },
    [key, setProgressByOperation],
  )

  return [progress, updateProgress] as const
}
