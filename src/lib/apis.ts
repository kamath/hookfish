import { notFound } from '@tanstack/react-router'
import type { ApiSummary, ClientApi } from './client-types'
import { apiAuthStored, clearApiAuth } from './auth'
import { DEFAULTS_VERSION, mergeDefaultSpecs } from './defaults'
import { specToClient } from './openapi'
import { fetchSpec } from './spec.functions'
import { readApisJson, readDefaultsVersion, writeApisJson, writeDefaultsVersion } from './storage'

const specCache = new Map<string, unknown>()
const specPending = new Map<string, Promise<unknown>>()
const clientCache = new Map<string, ClientApi>()

async function loadSpecDocument(url: string): Promise<unknown> {
  const cached = specCache.get(url)
  if (cached !== undefined) {
    return cached
  }

  const pending = specPending.get(url)
  if (pending) {
    return pending
  }

  const request = fetchSpec({ data: { url } }).then(
    (spec) => {
      specCache.set(url, spec)
      specPending.delete(url)
      return spec
    },
    (error: unknown) => {
      specPending.delete(url)
      throw error
    },
  )
  specPending.set(url, request)
  return request
}

function prefetchSpecs(apis: ApiSummary[]) {
  for (const api of apis.slice(0, 2)) {
    void getApi(api.id).catch(() => {})
  }
}

function isApiSummary(value: unknown): value is ApiSummary {
  if (!value || typeof value !== 'object') {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.specUrl === 'string' &&
    typeof row.operationCount === 'number' &&
    typeof row.createdAt === 'string' &&
    (row.version === undefined || typeof row.version === 'string')
  )
}

function loadApis(): ApiSummary[] {
  const raw = readApisJson()
  const stored = Array.isArray(raw) ? raw.filter(isApiSummary) : []
  const { apis, persist } = mergeDefaultSpecs(stored, readDefaultsVersion())
  if (persist) {
    saveApis(apis)
    writeDefaultsVersion(DEFAULTS_VERSION)
  }
  return apis
}

function saveApis(apis: ApiSummary[]) {
  writeApisJson(apis)
}

function rememberSpecMeta(id: string, client: ClientApi) {
  const apis = loadApis()
  const index = apis.findIndex((api) => api.id === id)
  if (index === -1) {
    return
  }
  const current = apis[index]
  if (!current) {
    return
  }
  apis[index] = {
    ...current,
    title: client.title,
    version: client.version,
    operationCount: client.operations.length,
  }
  saveApis(apis)
}

export function listApis(): ApiSummary[] {
  const apis = loadApis()
  prefetchSpecs(apis)
  return apis
}

export async function addApi(url: string): Promise<{ id: string }> {
  const spec = await loadSpecDocument(url)
  const id = crypto.randomUUID()
  const client = specToClient(spec, url, id)
  clientCache.set(id, client)
  const apis = loadApis()
  apis.unshift({
    id,
    title: client.title,
    version: client.version,
    specUrl: url,
    operationCount: client.operations.length,
    createdAt: new Date().toISOString(),
  })
  saveApis(apis)
  return { id }
}

export async function getApi(id: string): Promise<ClientApi> {
  const row = loadApis().find((api) => api.id === id)
  if (!row) {
    throw notFound()
  }

  let client = clientCache.get(row.id)
  if (!client || client.specUrl !== row.specUrl) {
    const spec = await loadSpecDocument(row.specUrl)
    client = specToClient(spec, row.specUrl, row.id)
    clientCache.set(row.id, client)
    rememberSpecMeta(row.id, client)
  }

  return {
    ...client,
    authStored: apiAuthStored(row.id),
  }
}

export function removeApi(id: string) {
  const row = loadApis().find((api) => api.id === id)
  saveApis(loadApis().filter((api) => api.id !== id))
  if (row) {
    specCache.delete(row.specUrl)
    specPending.delete(row.specUrl)
    clientCache.delete(id)
  }
  clearApiAuth(id)
}
