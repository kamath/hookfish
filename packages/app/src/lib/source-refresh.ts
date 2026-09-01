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

export const SOURCE_CACHE_MISSING_MESSAGE =
  'This source is not cached. Refresh to load it.'

export class SourceCacheMissingError extends Error {
  constructor() {
    super(SOURCE_CACHE_MISSING_MESSAGE)
    this.name = 'SourceCacheMissingError'
  }
}

export function isSourceCacheMissingError(
  error: unknown,
): error is SourceCacheMissingError {
  return error instanceof Error && error.name === 'SourceCacheMissingError'
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
