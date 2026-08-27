import type {
  AuthScheme,
  Executable,
  ExecutableSource,
  ExecutionResult,
} from './client-types'
import { asRecord, buildRequestUrl, omitEmpty } from './build-request'
import { getCloudProxy } from './cloud'
import { toFetch } from './export-snippet'
import { buildOperationRequest, httpBindingFor, type ExecuteRequest } from './invoke'
import { executeRequest } from './invoke.functions'
import { mcpExecutableAdapter } from './mcp/executable'
import { executeUpstreamRequest } from './upstream'

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
  exportSnippet?: (invocation: unknown) => string
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

registerExecutableAdapter('openapi', {
  buildInvocation: ({ source, executable, target, formData, credentials }) =>
    buildOperationRequest({
      serverUrl: target,
      operation: executable,
      formData,
      auth: credentials,
      authSchemes: openApiAuthSchemes(source),
    }),
  execute: (invocation) => {
    const request = asHttpInvocation(invocation)
    return getCloudProxy()
      ? executeRequest({ data: request })
      : executeUpstreamRequest(request)
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
  exportSnippet: (invocation) => toFetch(asHttpInvocation(invocation)),
})

registerExecutableAdapter('mcp', mcpExecutableAdapter)
