import { SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client'
import { queryOptions } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import type { RegistryEntryStatus } from '@hookfish/api'
import { apiJson, getApi } from './api'
import { getApi as getStoredApi, listApis } from './apis'
import { getCarouselCatalog } from './catalog-data'

export const carouselQueryOptions = queryOptions({
  queryKey: ['carousel-catalog'],
  queryFn: () => getCarouselCatalog(),
  staleTime: 5 * 60 * 1000,
})

export const apisQueryOptions = queryOptions({
  queryKey: ['apis'],
  queryFn: () => listApis(),
  staleTime: Infinity,
})

export function apiQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['api', id],
    queryFn: () => getStoredApi(id),
    retry: (count, error) => {
      if (isNotFound(error) || UnauthorizedError.isInstance(error)) {
        return false
      }
      return count < 1
    },
  })
}

export function registryEntryQueryOptions(url: string) {
  return queryOptions({
    queryKey: ['registry-entry', url],
    queryFn: async (): Promise<RegistryEntryStatus> => {
      const response = await getApi().registry.entry.$get({ query: { url } })
      return apiJson(response)
    },
    staleTime: 60_000,
    retry: (count, error) => {
      if (error instanceof Error && /not configured/i.test(error.message)) {
        return false
      }
      return count < 1
    },
  })
}

export async function registerSource(source: {
  sourceUrl: string
  title: string
  kind: string
}) {
  return apiJson(
    await getApi().spec.$post({
      json:
        source.kind === 'mcp'
          ? {
              url: source.sourceUrl,
              save: true,
              title: source.title,
              type: 'MCP',
            }
          : { url: source.sourceUrl, save: true },
    }),
  )
}

export function queryErrorMessage(error: unknown, fallback: string) {
  if (UnauthorizedError.isInstance(error)) {
    return 'This server needs you to sign in.'
  }
  if (SdkHttpError.isInstance(error)) {
    if (error.status === 403 || /denied access/i.test(error.message)) {
      return 'This server denied access.'
    }
    if (error.status === 401) {
      return 'This server needs you to sign in.'
    }
    if (/invalid session|session not found|session expired/i.test(
      `${error.message} ${error.data.text ?? ''}`,
    )) {
      return 'The session expired. Try again.'
    }
    if (/version negotiation failed/i.test(error.message)) {
      return 'Could not agree on a protocol version with this server.'
    }
    if (/error posting to endpoint/i.test(error.message)) {
      return sanitizeErrorText(
        error.message.replace(/^error posting to endpoint:\s*/i, ''),
        'Could not reach this server.',
      )
    }
  }
  if (error instanceof Error && error.message) {
    return sanitizeErrorText(error.message, fallback)
  }
  return fallback
}

function sanitizeErrorText(message: string, fallback: string) {
  const cleaned = message
    .replace(/^error posting to endpoint:\s*/i, '')
    .replace(/\bhttps?:\/\/[^\s)]+/gi, ' ')
    .replace(/\b(?:www\.)?[\w-]+(?:\.[\w-]+)+(?::\d+)?\/[^\s)]*/gi, ' ')
    .replace(/(?:^|\s)\/(?:apis|api|mcp)(?:\/[^\s]*)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
  if (!cleaned || cleaned.length < 3) {
    return fallback
  }
  return cleaned
}
