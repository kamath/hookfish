import { sourceRefreshWaitMs } from '@hookfish/api'

export {
  SOURCE_REFRESH_COOLDOWN_MESSAGE,
  SOURCE_REFRESH_MIN_INTERVAL_MS,
  RegistryRefreshTooSoonError,
  assertCanForceRefresh,
  sourceRefreshWaitMs,
} from '@hookfish/api'

export function isSourceRefreshTooSoonError(
  error: unknown,
): error is Error & { name: 'RegistryRefreshTooSoonError' } {
  return error instanceof Error && error.name === 'RegistryRefreshTooSoonError'
}

export function formatSourceUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function sourceRefreshBlocked(updatedAt: string | undefined, now = Date.now()) {
  return sourceRefreshWaitMs(updatedAt, now) > 0
}
