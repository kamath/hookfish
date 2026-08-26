import { notFound } from '@tanstack/react-router'
import type { ApiSummary, ClientApi } from './client-types'
import { apiAuthStored, clearApiAuth } from './auth'
import { DEFAULTS_VERSION, mergeDefaultSpecs } from './defaults'
import { specToClient } from './openapi'
import { fetchSpec } from './spec.functions'
import { readApisJson, readDefaultsVersion, writeApisJson, writeDefaultsVersion } from './storage'

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
  return loadApis()
}

export async function addApi(url: string): Promise<{ id: string }> {
  const spec = await fetchSpec({ data: { url } })
  const id = crypto.randomUUID()
  const client = specToClient(spec, url, id)
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

  const spec = await fetchSpec({ data: { url: row.specUrl } })
  const client = specToClient(spec, row.specUrl, row.id)
  rememberSpecMeta(row.id, client)

  return {
    ...client,
    authStored: apiAuthStored(row.id),
  }
}

export function removeApi(id: string) {
  saveApis(loadApis().filter((api) => api.id !== id))
  clearApiAuth(id)
}
