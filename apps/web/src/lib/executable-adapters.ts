import { executeUpstreamRequest } from '@hookfish/api'
import { apiJson, getApi } from './api'
import type {
  AuthScheme,
  Executable,
  ExecutableSource,
  ExecutionResult,
} from './client-types'
import { asRecord, buildRequestUrl, omitEmpty } from './build-request'
import { getCloudProxy } from './cloud'
import { toHttpExportSnippet } from './export-snippet'
import { buildOperationRequest, httpBindingFor, type ExecuteRequest } from './invoke'
import { mcpExecutableAdapter } from './mcp/executable'
import { localUpstreamFetch } from './upstream'

export type InvocationContext = {
  source: ExecutableSource
  executable: Executable
  target: string
  formData: unknown
  credentials: Record<string, string>
}

export type ExecutableAdapter = {
  buildInvocation: (context: InvocationContext) => unknown
  execute: (invocation: unknown) => Promise<ExecutionResult>
  continue?: (
    invocation: unknown,
    inputResponses: Record<string, unknown>,
    requestState?: string,
  ) => Promise<ExecutionResult>
  preview: (context: Omit<InvocationContext, 'credentials'>) => string
  exportSnippet?: (context: InvocationContext) => string
}

const adapters = new Map<string, ExecutableAdapter>()

export function registerExecutableAdapter(kind: string, adapter: ExecutableAdapter) {
  adapters.set(kind, adapter)
}

export function executableAdapterFor(source: ExecutableSource) {
  const adapter = adapters.get(source.kind)
  if (!adapter) {
    throw new Error(`No executable adapter is registered for "${source.kind}".`)
  }
  return adapter
}

function openApiAuthSchemes(source: ExecutableSource): AuthScheme[] {
  const schemes = asRecord(source.adapterData).authSchemes
  return Array.isArray(schemes) ? (schemes as AuthScheme[]) : []
}

function asHttpInvocation(value: unknown): ExecuteRequest {
  const invocation = asRecord(value)
  if (invocation.transport !== 'http') {
    throw new Error('Expected an HTTP invocation.')
  }
  return invocation as ExecuteRequest
}

function buildOpenApiInvocation(context: InvocationContext): ExecuteRequest {
  return buildOperationRequest({
    serverUrl: context.target,
    operation: context.executable,
    formData: context.formData,
    auth: context.credentials,
    authSchemes: openApiAuthSchemes(context.source),
  })
}

registerExecutableAdapter('openapi', {
  buildInvocation: buildOpenApiInvocation,
  execute: async (invocation) => {
    const request = asHttpInvocation(invocation)
    return getCloudProxy()
      ? apiJson(await getApi().execute.$post({ json: request }))
      : executeUpstreamRequest(request, localUpstreamFetch)
  },
  preview: ({ executable, target, formData }) => {
    let binding
    try {
      binding = httpBindingFor(executable)
    } catch {
      return executable.name
    }
    const data = asRecord(formData)
    try {
      return buildRequestUrl(
        target,
        binding.path,
        asRecord(omitEmpty(data.path)),
        asRecord(omitEmpty(data.query)),
      )
    } catch {
      return `${target}${binding.path}`
    }
  },
  exportSnippet: (context) =>
    toHttpExportSnippet(buildOpenApiInvocation(context), context),
})

registerExecutableAdapter('mcp', mcpExecutableAdapter)
