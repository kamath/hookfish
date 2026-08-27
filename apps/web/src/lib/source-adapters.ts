import type { ExecutableSource } from './client-types'
import { loadMcpSource } from './mcp/source'
import { specToClient } from './openapi'
import { fetchSpec } from './spec.functions'

export type SourceSubmitHotkey = 'Enter' | 'Mod+Enter'

export type SourceAdapter = {
  kind: string
  label: string
  inputLabel: string
  submitHotkey: SourceSubmitHotkey
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
  return [...sourceAdapters.values()].map(({ kind, label, inputLabel, submitHotkey }) => ({
    kind,
    label,
    inputLabel,
    submitHotkey,
  }))
}

export function sourceAdapterForSubmit(hotkey: SourceSubmitHotkey) {
  return [...sourceAdapters.values()].find((adapter) => adapter.submitHotkey === hotkey)
}

registerSourceAdapter({
  kind: 'mcp',
  label: 'MCP',
  inputLabel: 'Streamable HTTP endpoint',
  submitHotkey: 'Enter',
  load: loadMcpSource,
})

registerSourceAdapter({
  kind: 'openapi',
  label: 'OpenAPI',
  inputLabel: 'OpenAPI document URL',
  submitHotkey: 'Mod+Enter',
  load: async (sourceUrl, id) => {
    const document = await fetchSpec({ data: { url: sourceUrl } })
    return specToClient(document, sourceUrl, id)
  },
})
