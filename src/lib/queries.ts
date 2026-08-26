import { queryOptions } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { getApi, listApis } from './apis'

export const apisQueryOptions = queryOptions({
  queryKey: ['apis'],
  queryFn: () => listApis(),
  staleTime: Infinity,
})

export function apiQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['api', id],
    queryFn: () => getApi(id),
    staleTime: Infinity,
    retry: (count, error) => {
      if (isNotFound(error)) {
        return false
      }
      return count < 1
    },
  })
}

export function queryErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
