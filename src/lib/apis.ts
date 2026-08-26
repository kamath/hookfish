import { notFound } from '@tanstack/react-router'
import type { ApiSummary, ClientApi } from './client-types'
import { apiAuthStored, clearApiAuth } from './auth'
import { DEFAULTS_VERSION, mergeDefaultSpecs } from './defaults'
import { specToClient } from './openapi'
import { fetchSpec } from './spec.functions'
import { readApisJson, readDefaultsVersion, writeApisJson, writeDefaultsVersion } from './storage'

function sourceSummary(value: unknown): ApiSummary | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const row = value as Record<string, unknown>
  const sourceUrl =
    typeof row.sourceUrl === 'string'
      ? row.sourceUrl
      : typeof row.specUrl === 'string'
        ? row.specUrl
        : undefined
  const executableCount =
    typeof row.executableCount === 'number'
      ? row.executableCount
      : typeof row.operationCount === 'number'
        ? row.operationCount
        : undefined
  if (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    sourceUrl &&
    executableCount !== undefined &&
    typeof row.createdAt === 'string' &&
    (row.version === undefined || typeof row.version === 'string')
  ) {
    return {
      id: row.id,
      kind: typeof row.kind === 'string' ? row.kind : 'openapi',
      title: row.title,
      version: row.version as string | undefined,
      sourceUrl,
      executableCount,
      createdAt: row.createdAt,
    }
  }
  return undefined
}

function loadApis(): ApiSummary[] {
  const raw = readApisJson()
  const stored = Array.isArray(raw)
    ? raw.map(sourceSummary).filter((value): value is ApiSummary => Boolean(value))
    : []
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
    executableCount: client.executables.length,
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
    kind: client.kind,
    title: client.title,
    version: client.version,
    sourceUrl: url,
    executableCount: client.executables.length,
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

  const spec = await fetchSpec({ data: { url: row.sourceUrl } })
  const client = specToClient(spec, row.sourceUrl, row.id)
  rememberSpecMeta(row.id, client)

  return {
    ...client,
    credentialsStored: apiAuthStored(row.id),
  }
}

export function removeApi(id: string) {
  saveApis(loadApis().filter((api) => api.id !== id))
  clearApiAuth(id)
}
