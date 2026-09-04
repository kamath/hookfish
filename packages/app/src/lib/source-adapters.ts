import { fetchUpstreamSpec } from '@hookfish/api'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { apiJson, getApi, isOwnOpenApiUrl } from './api'
import type { ExecutableSource } from './client-types'
import { getCloudProxy } from './cloud'
import { pendingMcpAuthorization } from './mcp/oauth'
import { loadMcpSource } from './mcp/source'
import { isOpenApiDocument, specToClient } from './openapi'
import { probeSource } from './source-kind'
import { localUpstreamFetch } from './upstream'

export type SourceAdapter = {
  kind: string
  label: string
  load: (
    sourceUrl: string,
    id: string,
    credentials: Record<string, string>,
  ) => Promise<ExecutableSource>
}

const sourceAdapters = new Map<string, SourceAdapter>()

export function registerSourceAdapter(adapter: SourceAdapter) {
  sourceAdapters.set(adapter.kind, adapter)
}

export function sourceAdapterFor(kind: string) {
  const adapter = sourceAdapters.get(kind)
  if (!adapter) {
    throw new Error(`No source adapter is registered for "${kind}".`)
  }
  return adapter
}

async function readOpenApiDocument(sourceUrl: string): Promise<unknown> {
  return isOwnOpenApiUrl(sourceUrl)
    ? apiJson(await getApi()['openapi.json'].$get())
    : getCloudProxy()
      ? apiJson(await getApi().spec.$post({ json: { url: sourceUrl } }))
      : fetchUpstreamSpec(sourceUrl, localUpstreamFetch)
}

registerSourceAdapter({
  kind: 'mcp',
  label: 'MCP',
  load: loadMcpSource,
})

registerSourceAdapter({
  kind: 'openapi',
  label: 'OpenAPI',
  load: async (sourceUrl, id) => specToClient(await readOpenApiDocument(sourceUrl), sourceUrl, id),
})

export async function loadInferredSource(
  sourceUrl: string,
  id: string,
  credentials: Record<string, string>,
  beforeMcp?: () => void,
): Promise<ExecutableSource> {
  return probeSource({
    readOpenApi: async () => {
      const document = await readOpenApiDocument(sourceUrl)
      return isOpenApiDocument(document) ? document : undefined
    },
    loadOpenApi: (document) => specToClient(document, sourceUrl, id),
    loadMcp: async () => {
      beforeMcp?.()
      return loadMcpSource(sourceUrl, id, credentials)
    },
    isMcpAuthorization: (error) =>
      UnauthorizedError.isInstance(error) &&
      pendingMcpAuthorization()?.sourceId === id,
  })
}

export async function loadSource(
  sourceUrl: string,
  id: string,
  credentials: Record<string, string>,
  kind?: string,
  beforeMcp?: () => void,
): Promise<ExecutableSource> {
  if (!kind) {
    return loadInferredSource(sourceUrl, id, credentials, beforeMcp)
  }
  if (kind === 'mcp') {
    beforeMcp?.()
  }
  return sourceAdapterFor(kind).load(sourceUrl, id, credentials)
}
