import { queryOptions } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { getApi, listApis } from './apis.functions'
import { getSession } from './session.functions'

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: () => getSession(),
  staleTime: Infinity,
})

export const apisQueryOptions = queryOptions({
  queryKey: ['apis'],
  queryFn: () => listApis(),
})

export function apiQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['api', id],
    queryFn: () => getApi({ data: { id } }),
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
