import { notFound } from '@tanstack/react-router'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import type { RegistryEntryMetadata } from '@hookfish/api'
import type {
  ApiSummary,
  ClientApi,
  Executable,
  ExecutableGroup,
  FormUiSchema,
  JsonSchema,
  SourceLabels,
} from './client-types'
import { apiJson, getApi as getApiClient } from './api'
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
import {
  RegistryRefreshTooSoonError,
  assertCanForceRefresh,
  isSourceRefreshTooSoonError,
} from './source-refresh'
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
    (row.version === undefined || typeof row.version === 'string') &&
    (row.updatedAt === undefined || typeof row.updatedAt === 'string')
  ) {
    return {
      id: row.id,
      kind: typeof row.kind === 'string' ? row.kind : 'openapi',
      title: row.title,
      version: row.version as string | undefined,
      sourceUrl,
      executableCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt as string | undefined,
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
    credentialSchema: client.credentialSchema,
    credentialUiSchema: client.credentialUiSchema,
    credentialsRequired: client.credentialsRequired,
  }
}

export function sourceFromRegistryEntry(
  row: Pick<ApiSummary, 'id' | 'kind' | 'sourceUrl'>,
  entry: {
    metadata: RegistryEntryMetadata
    updatedAt: string
  },
): ClientApi {
  const adapterData = cacheableAdapterData(entry.metadata.adapterData)
  return {
    id: row.id,
    kind: entry.metadata.kind,
    title: entry.metadata.title,
    version: entry.metadata.version,
    description: entry.metadata.description,
    sourceUrl: row.sourceUrl,
    targets: [row.sourceUrl],
    executables: entry.metadata.executables as Executable[],
    groups: entry.metadata.groups as ExecutableGroup[],
    labels: entry.metadata.labels as SourceLabels,
    adapterData:
      row.kind === 'mcp' || entry.metadata.kind === 'mcp'
        ? {
            ...(adapterData && typeof adapterData === 'object' ? adapterData : {}),
            oauthAuthorized: hasMcpOAuthTokens(row.id),
          }
        : adapterData,
    credentialSchema: entry.metadata.credentialSchema as JsonSchema | undefined,
    credentialUiSchema: entry.metadata.credentialUiSchema as FormUiSchema | undefined,
    credentialsRequired: entry.metadata.credentialsRequired,
    credentialsStored: apiAuthStored(row.id) || hasMcpOAuthTokens(row.id),
    updatedAt: entry.updatedAt,
  }
}

type RegistryEntryResponse = {
  entry: {
    metadata: RegistryEntryMetadata
    updatedAt: string
  }
}

async function readRegistryEntry(sourceId: string) {
  try {
    const response = await getApiClient().registry[':sourceId'].$get({
      param: { sourceId },
    })
    if (!response.ok) {
      return undefined
    }
    return await apiJson<RegistryEntryResponse>(response)
  } catch {
    return undefined
  }
}

async function submitRegistryEntry(
  client: ClientApi,
  options?: { force?: boolean },
) {
  const metadata = registryEntryMetadata(client)
  if (!metadata) {
    return
  }
  const response = await getApiClient().registry[':sourceId'].$put({
    param: { sourceId: client.id },
    json: {
      sourceUrl: client.sourceUrl,
      metadata,
      ...(options?.force ? { force: true } : {}),
    },
  })
  if (response.status === 429) {
    throw new RegistryRefreshTooSoonError(
      60_000,
      client.updatedAt ?? new Date().toISOString(),
    )
  }
  if (!response.ok) {
    return
  }
  const body = (await response.json()) as {
    entry?: { updatedAt?: string } | null
  }
  return typeof body.entry?.updatedAt === 'string' ? body.entry.updatedAt : undefined
}

function rememberSpecMeta(id: string, client: ClientApi, updatedAt?: string) {
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
    updatedAt: updatedAt ?? client.updatedAt ?? current.updatedAt,
  }
  saveApis(apis)
}

function requireApiRow(id: string) {
  const row = loadApis().find((api) => api.id === id)
  if (!row) {
    throw notFound()
  }
  return row
}

function hydrateLiveApi(id: string, client: ClientApi, updatedAt?: string): ClientApi {
  return {
    ...client,
    credentialsStored: apiAuthStored(id) || hasMcpOAuthTokens(id),
    updatedAt: updatedAt ?? new Date().toISOString(),
  }
}

async function loadLiveApi(
  row: ApiSummary,
  options?: { force?: boolean },
): Promise<ClientApi> {
  const client = await sourceAdapterFor(row.kind).load(
    row.sourceUrl,
    row.id,
    readApiAuth(row.id),
  )
  const updatedAt =
    row.cache !== false
      ? await submitRegistryEntry(client, options).catch((error) => {
          if (isSourceRefreshTooSoonError(error)) {
            throw error
          }
          return undefined
        })
      : undefined
  const next = hydrateLiveApi(row.id, client, updatedAt)
  rememberSpecMeta(row.id, next, next.updatedAt)
  return next
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
  const updatedAt = new Date().toISOString()
  const apis = loadApis()
  const summary = {
    id,
    kind: client.kind,
    title: client.title,
    version: client.version,
    sourceUrl: url,
    executableCount: client.executables.length,
    createdAt: updatedAt,
    updatedAt,
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
    const cachedAt = await submitRegistryEntry(client).catch(() => undefined)
    if (cachedAt) {
      rememberSpecMeta(id, client, cachedAt)
    }
  }
  return { id }
}

export async function getApi(id: string): Promise<ClientApi> {
  const row = requireApiRow(id)
  if (row.cache !== false) {
    const cached = await readRegistryEntry(row.id)
    if (cached) {
      const client = sourceFromRegistryEntry(row, cached.entry)
      rememberSpecMeta(row.id, client, client.updatedAt)
      return client
    }
  }
  return loadLiveApi(row)
}

export async function refreshApi(
  id: string,
  options?: { force?: boolean; updatedAt?: string; now?: number },
): Promise<ClientApi> {
  const row = requireApiRow(id)
  if (options?.force) {
    const updatedAt =
      options.updatedAt ??
      (row.cache !== false ? (await readRegistryEntry(row.id))?.entry.updatedAt : undefined)
    assertCanForceRefresh(updatedAt, options.now)
  }
  return loadLiveApi(row, { force: options?.force })
}

export function removeApi(id: string) {
  saveApis(loadApis().filter((api) => api.id !== id))
  clearApiAuth(id)
  clearMcpOAuth(id)
  void closeMcpConnection(id)
}
