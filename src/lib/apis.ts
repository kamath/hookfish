import { notFound } from '@tanstack/react-router'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import type { ApiSummary, ClientApi } from './client-types'
import {
  apiAuthStored,
  clearApiAuth,
  readApiAuth,
  saveApiAuth,
} from './auth'
import { DEFAULTS_VERSION, mergeDefaultSpecs } from './defaults'
import { sourceAdapterFor } from './source-adapters'
import { closeMcpConnection } from './mcp/client'
import { clearMcpOAuth, hasMcpOAuthTokens } from './mcp/oauth'
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

export async function addApi(
  url: string,
  kind = 'openapi',
  credentials: Record<string, string> = {},
): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  saveApiAuth(id, credentials)
  if (kind === 'mcp') {
    const apis = loadApis()
    apis.unshift({
      id,
      kind,
      title: new URL(url).hostname,
      sourceUrl: url,
      executableCount: 0,
      createdAt: new Date().toISOString(),
    })
    saveApis(apis)
  }
  let client: ClientApi
  try {
    client = await sourceAdapterFor(kind).load(url, id, credentials)
  } catch (error) {
    if (kind === 'mcp' && UnauthorizedError.isInstance(error)) {
      throw error
    }
    if (kind === 'mcp') {
      saveApis(loadApis().filter((api) => api.id !== id))
      clearMcpOAuth(id)
    }
    clearApiAuth(id)
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
  }
  const provisionalIndex = apis.findIndex((api) => api.id === id)
  if (provisionalIndex === -1) {
    apis.unshift(summary)
  } else {
    apis[provisionalIndex] = summary
  }
  saveApis(apis)
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
