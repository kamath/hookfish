import { notFound } from '@tanstack/react-router'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import type { RegistryEntryMetadata } from '@hookfish/api'
import type { ApiSummary, ClientApi } from './client-types'
import { getApi as getApiClient } from './api'
import {
  apiAuthStored,
  clearApiAuth,
  readApiAuth,
  saveApiAuth,
} from './auth'
import { loadSource, sourceAdapterFor } from './source-adapters'
import { closeMcpConnection } from './mcp/client'
import {
  clearMcpOAuth,
  hasMcpOAuthTokens,
  pendingMcpAuthorization,
} from './mcp/oauth'
import { readApisJson, writeApisJson } from './storage'

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
      cache: row.cache !== false,
    }
  }
  return undefined
}

function loadApis(): ApiSummary[] {
  const raw = readApisJson()
  return Array.isArray(raw)
    ? raw.map(sourceSummary).filter((value): value is ApiSummary => Boolean(value))
    : []
}

function saveApis(apis: ApiSummary[]) {
  writeApisJson(apis)
}

function cacheableAdapterData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }
  const {
    sessionId: _sessionId,
    oauthAuthorized: _oauthAuthorized,
    ...cacheable
  } = value as Record<string, unknown>
  return cacheable
}

export function registryEntryMetadata(
  client: ClientApi,
): RegistryEntryMetadata | undefined {
  const kind = client.kind
  if (kind !== 'openapi' && kind !== 'mcp') {
    return undefined
  }
  return {
    kind,
    title: client.title,
    version: client.version,
    description: client.description,
    executables: client.executables,
    groups: client.groups,
    labels: client.labels,
    adapterData: cacheableAdapterData(client.adapterData),
  }
}

async function submitRegistryEntry(client: ClientApi) {
  const metadata = registryEntryMetadata(client)
  if (!metadata) {
    return
  }
  await getApiClient().registry[':sourceId'].$put({
    param: { sourceId: client.id },
    json: { metadata },
  })
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

function rememberProvisional(id: string, url: string) {
  const apis = loadApis()
  if (apis.some((api) => api.id === id)) {
    return
  }
  apis.unshift({
    id,
    kind: 'mcp',
    title: new URL(url).hostname,
    sourceUrl: url,
    executableCount: 0,
    createdAt: new Date().toISOString(),
  })
  saveApis(apis)
}

export async function addApi(
  url: string,
  kind?: string,
  credentials: Record<string, string> = {},
  options: { cache?: boolean } = {},
): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  saveApiAuth(id, credentials)
  let client: ClientApi
  try {
    client = await loadSource(url, id, credentials, kind, () => rememberProvisional(id, url))
  } catch (error) {
    if (
      UnauthorizedError.isInstance(error) &&
      pendingMcpAuthorization()?.sourceId === id
    ) {
      throw error
    }
    saveApis(loadApis().filter((api) => api.id !== id))
    clearMcpOAuth(id)
    clearApiAuth(id)
    await closeMcpConnection(id)
    throw error
  }
  const apis = loadApis()
  const summary = {
    id,
    kind: client.kind,
    title: client.title,
    version: client.version,
    sourceUrl: url,
    executableCount: client.executables.length,
    createdAt: new Date().toISOString(),
    cache: options.cache ?? true,
  }
  const provisionalIndex = apis.findIndex((api) => api.id === id)
  if (provisionalIndex === -1) {
    apis.unshift(summary)
  } else {
    apis[provisionalIndex] = summary
  }
  saveApis(apis)
  if (summary.cache) {
    void submitRegistryEntry(client).catch(() => {})
  }
  return { id }
}

export async function getApi(id: string): Promise<ClientApi> {
  const row = loadApis().find((api) => api.id === id)
  if (!row) {
    throw notFound()
  }

  const client = await sourceAdapterFor(row.kind).load(
    row.sourceUrl,
    row.id,
    readApiAuth(row.id),
  )
  rememberSpecMeta(row.id, client)
  if (row.cache !== false) {
    void submitRegistryEntry(client).catch(() => {})
  }

  return {
    ...client,
    credentialsStored: apiAuthStored(row.id) || hasMcpOAuthTokens(row.id),
  }
}

export function removeApi(id: string) {
  saveApis(loadApis().filter((api) => api.id !== id))
  clearApiAuth(id)
  clearMcpOAuth(id)
  void closeMcpConnection(id)
}
