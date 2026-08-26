import type { ExecutionResult, JsonValue, McpBinding } from '../client-types'
import type {
  ExecutableAdapter,
  InvocationContext,
} from '../executable-adapters'
import { asRecord } from '../build-request'
import { getMcpConnection, traceMark, traceSince } from './client'

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
  const connection = await getMcpConnection(invocation.sourceId, invocation.endpoint)
  const mark = traceMark(connection)
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
          requests: JSON.parse(JSON.stringify(asRecord(record.inputRequests))) as Record<
            string,
            JsonValue
          >,
          requestState:
            typeof record.requestState === 'string' ? record.requestState : undefined,
        }
      : undefined

  return {
    status: {
      text: inputRequired ? 'Input required' : 'Complete',
    },
    details: {
      label: 'MCP',
      items: [
        { name: 'Protocol', value: connection.client.getNegotiatedProtocolVersion() ?? 'unknown' },
        { name: 'Era', value: connection.client.getProtocolEra() ?? 'legacy' },
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
}

function exportSnippet(invocation: unknown) {
  const value = asInvocation(invocation)
  const call =
    value.binding.method === 'tools/call'
      ? `client.callTool(${JSON.stringify(value.params, null, 2)})`
      : value.binding.method === 'resources/read'
        ? `client.readResource(${JSON.stringify(value.params, null, 2)})`
        : `client.getPrompt(${JSON.stringify(value.params, null, 2)})`
  return `import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const client = new Client(
  { name: 'example-client', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
)
const transport = new StreamableHTTPClientTransport(
  new URL(${JSON.stringify(value.endpoint)}),
)

await client.connect(transport)
const result = await ${call}
console.log(result)`
}

export const mcpExecutableAdapter: ExecutableAdapter = {
  buildInvocation: ({ source, executable, target, formData }) => {
    const binding = mcpBinding(executable.binding)
    return {
      transport: 'mcp',
      sourceId: source.id,
      endpoint: target,
      binding,
      params: invocationParams(binding, formData),
    } satisfies McpInvocation
  },
  execute: executeMcp,
  continue: (invocation, inputResponses, requestState) =>
    executeMcp(invocation, { inputResponses, requestState }),
  preview: ({ executable }) => {
    const binding = mcpBinding(executable.binding)
    return `${binding.method} · ${binding.name}`
  },
  exportSnippet,
}
