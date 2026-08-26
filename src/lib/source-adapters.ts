import type { ExecutableSource } from './client-types'
import { ARCADE_SPEC_URL } from './defaults'
import { loadMcpSource } from './mcp/source'
import { specToClient } from './openapi'
import { fetchSpec } from './spec.functions'

export type SourceCredentialField = {
  name: string
  label: string
  type?: 'text' | 'password'
  placeholder?: string
}

export type SourceAdapter = {
  kind: string
  label: string
  inputLabel: string
  placeholder?: string
  credentialFields?: SourceCredentialField[]
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

export function sourceAdapterOptions() {
  return [...sourceAdapters.values()].map(
    ({ kind, label, inputLabel, placeholder, credentialFields }) => ({
      kind,
      label,
      inputLabel,
      placeholder,
      credentialFields,
    }),
  )
}

registerSourceAdapter({
  kind: 'openapi',
  label: 'OpenAPI',
  inputLabel: 'OpenAPI document URL',
  placeholder: ARCADE_SPEC_URL,
  load: async (sourceUrl, id) => {
    const document = await fetchSpec({ data: { url: sourceUrl } })
    return specToClient(document, sourceUrl, id)
  },
})

registerSourceAdapter({
  kind: 'mcp',
  label: 'MCP',
  inputLabel: 'Streamable HTTP endpoint',
  placeholder: 'https://example.com/mcp',
  load: loadMcpSource,
})
