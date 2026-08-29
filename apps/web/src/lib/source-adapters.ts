import { fetchUpstreamSpec } from '@hookfish/api'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { apiJson, getApi, isOwnOpenApiUrl } from './api'
import type { ExecutableSource } from './client-types'
import { getCloudProxy } from './cloud'
import { loadMcpSource } from './mcp/source'
import { isOpenApiDocument, specToClient } from './openapi'
import { neitherSourceError, sourceProbeOrder } from './source-kind'
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

async function tryReadOpenApiDocument(sourceUrl: string) {
  try {
    const document = await readOpenApiDocument(sourceUrl)
    if (isOpenApiDocument(document)) {
      return { document }
    }
    return { error: new Error('The URL did not return an OpenAPI or Swagger document.') }
  } catch (error) {
    return { error }
  }
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
  const errors: unknown[] = []

  for (const kind of sourceProbeOrder(sourceUrl)) {
    if (kind === 'openapi') {
      const result = await tryReadOpenApiDocument(sourceUrl)
      if ('document' in result) {
        return specToClient(result.document, sourceUrl, id)
      }
      errors.push(result.error)
      continue
    }

    beforeMcp?.()
    try {
      return await loadMcpSource(sourceUrl, id, credentials)
    } catch (error) {
      if (UnauthorizedError.isInstance(error)) {
        throw error
      }
      errors.push(error)
    }
  }

  throw neitherSourceError(errors)
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
