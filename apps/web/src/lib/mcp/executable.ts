import type {
  Executable,
  ExecutionResult,
  JsonValue,
  McpBinding,
} from '../client-types'
import { executableSnippetName, withZodExport } from '../export-snippet'
import type {
  ExecutableAdapter,
  InvocationContext,
} from '../executable-adapters'
import { asRecord } from '../build-request'
import { traceMark, traceSince, withMcpConnection } from './client'

type McpInvocation = {
  transport: 'mcp'
  sourceId: string
  endpoint: string
  binding: McpBinding
  params: Record<string, unknown>
}

function mcpBinding(value: InvocationContext['executable']['binding']): McpBinding {
  if (
    value.type !== 'mcp' ||
    typeof value.kind !== 'string' ||
    typeof value.method !== 'string' ||
    typeof value.name !== 'string'
  ) {
    throw new Error('The executable does not have a valid MCP binding.')
  }
  return value as McpBinding
}

function invocationParams(binding: McpBinding, formData: unknown) {
  const form = asRecord(formData)
  switch (binding.kind) {
    case 'tool':
      return {
        name: binding.name,
        arguments: form,
      }
    case 'resource':
      return { uri: binding.name }
    case 'resource-template':
      return { uri: typeof form.uri === 'string' ? form.uri : binding.name }
    case 'prompt':
      return {
        name: binding.name,
        arguments: Object.fromEntries(
          Object.entries(form).map(([name, value]) => [name, String(value)]),
        ),
      }
  }
}

function asInvocation(value: unknown): McpInvocation {
  const invocation = asRecord(value)
  if (
    invocation.transport !== 'mcp' ||
    typeof invocation.sourceId !== 'string' ||
    typeof invocation.endpoint !== 'string'
  ) {
    throw new Error('Expected an MCP invocation.')
  }
  return value as McpInvocation
}

async function executeMcp(
  value: unknown,
  continuation?: {
    inputResponses: Record<string, unknown>
    requestState?: string
  },
): Promise<ExecutionResult> {
  const invocation = asInvocation(value)
  const params = {
    ...invocation.params,
    ...(continuation
      ? {
          inputResponses: continuation.inputResponses,
          requestState: continuation.requestState,
        }
      : {}),
  }
  const options = { allowInputRequired: true } as never
  const started = performance.now()
  return withMcpConnection(
    invocation.sourceId,
    invocation.endpoint,
    async (connection) => {
      const mark = traceMark(connection)
      let result: unknown
      switch (invocation.binding.method) {
        case 'tools/call':
          result = await connection.client.callTool(params as never, options)
          break
        case 'resources/read':
          result = await connection.client.readResource(params as never, options)
          break
        case 'prompts/get':
          result = await connection.client.getPrompt(params as never, options)
          break
      }
      const elapsedMs = Math.round(performance.now() - started)
      const record = asRecord(result)
      const inputRequired =
        record.resultType === 'input_required'
          ? {
              requests: JSON.parse(
                JSON.stringify(asRecord(record.inputRequests)),
              ) as Record<string, JsonValue>,
              requestState:
                typeof record.requestState === 'string'
                  ? record.requestState
                  : undefined,
            }
          : undefined

      return {
        status: {
          text: inputRequired ? 'Input required' : 'Complete',
        },
        details: {
          label: 'MCP',
          items: [
            {
              name: 'Protocol',
              value: connection.client.getNegotiatedProtocolVersion() ?? 'unknown',
            },
            {
              name: 'Era',
              value: connection.client.getProtocolEra() ?? 'legacy',
            },
            { name: 'Method', value: invocation.binding.method },
          ],
        },
        body: JSON.stringify(result, null, 2),
        elapsedMs,
        target: invocation.endpoint,
        action: invocation.binding.method,
        trace: traceSince(connection, mark),
        inputRequired,
      }
    },
  )
}

function buildMcpInvocation(context: InvocationContext): McpInvocation {
  const binding = mcpBinding(context.executable.binding)
  return {
    transport: 'mcp',
    sourceId: context.source.id,
    endpoint: context.target,
    binding,
    params: invocationParams(binding, context.formData),
  }
}

function exportSnippet(context: InvocationContext) {
  const value = buildMcpInvocation(context)
  const executable: Executable = context.executable
  const input =
    value.binding.kind === 'tool' || value.binding.kind === 'prompt'
      ? asRecord(value.params).arguments
      : value.binding.kind === 'resource-template'
        ? { uri: asRecord(value.params).uri }
        : {}
  const call =
    value.binding.method === 'tools/call'
      ? `client.callTool({\n  name: ${JSON.stringify(value.binding.name)},\n  arguments: input,\n})`
      : value.binding.method === 'resources/read'
        ? value.binding.kind === 'resource-template'
          ? `client.readResource({\n  uri: input.uri,\n})`
          : `client.readResource(${JSON.stringify(value.params, null, 2)})`
        : `client.getPrompt({\n  name: ${JSON.stringify(value.binding.name)},\n  arguments: input,\n})`
  return withZodExport({
    name: executableSnippetName(executable),
    inputSchema: executable.inputSchema,
    outputSchema: executable.outputSchema,
    imports: [
      "import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'",
    ],
    setup: `const client = new Client(
  { name: 'example-client', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
)
const transport = new StreamableHTTPClientTransport(
  new URL(${JSON.stringify(value.endpoint)}),
)

await client.connect(transport)`,
    input,
    result: (outputSchemaName) =>
      outputSchemaName
        ? `const response = await ${call}
const result = ${outputSchemaName}.parse(response.structuredContent)`
        : `const result = await ${call}`,
  })
}

export const mcpExecutableAdapter: ExecutableAdapter = {
  buildInvocation: buildMcpInvocation,
  execute: executeMcp,
  continue: (invocation, inputResponses, requestState) =>
    executeMcp(invocation, { inputResponses, requestState }),
  preview: ({ executable }) => {
    const binding = mcpBinding(executable.binding)
    return `${binding.method} · ${binding.name}`
  },
  exportSnippet,
}
