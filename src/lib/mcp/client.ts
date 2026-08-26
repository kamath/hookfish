import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import type { JsonValue, ProtocolTraceEntry } from '../client-types'

const CLIENT_INFO = {
  name: 'hookfish-inspector',
  version: '1.0.0',
}

type McpConnection = {
  client: Client
  transport: StreamableHTTPClientTransport
  endpoint: string
  credentialKey: string
  trace: ProtocolTraceEntry[]
  startedAt: number
}

const connections = new Map<string, McpConnection>()
const changeListeners = new Map<string, Set<() => void>>()

function traceEntry(
  connection: Pick<McpConnection, 'trace' | 'startedAt'>,
  entry: Omit<ProtocolTraceEntry, 'atMs'>,
) {
  connection.trace.push({
    ...entry,
    atMs: Date.now() - connection.startedAt,
  })
  if (connection.trace.length > 500) {
    connection.trace.splice(0, connection.trace.length - 500)
  }
}

function requestSummary(body: BodyInit | null | undefined) {
  if (typeof body !== 'string') {
    return { summary: 'MCP request', detail: undefined }
  }
  try {
    const message = JSON.parse(body) as Record<string, unknown>
    const method = typeof message.method === 'string' ? message.method : 'message'
    return { summary: method, detail: message as JsonValue }
  } catch {
    return { summary: 'MCP request', detail: body }
  }
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function proxyFetch(connection: Pick<McpConnection, 'trace' | 'startedAt'>) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const target =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.toString()
          : input
    const proxyUrl = new URL('/api/mcp-proxy', window.location.origin)
    proxyUrl.searchParams.set('url', target)
    const request = requestSummary(init?.body)
    traceEntry(connection, {
      direction: 'out',
      kind: 'jsonrpc',
      summary: request.summary,
      detail: request.detail,
    })
    const response = await fetch(proxyUrl, init)
    traceEntry(connection, {
      direction: 'in',
      kind: 'http',
      summary: `${response.status} ${response.statusText}`.trim(),
      detail: {
        contentType: response.headers.get('content-type'),
        sessionId: response.headers.get('mcp-session-id'),
      },
    })
    return response
  }
}

function extraHeaders(credentials: Record<string, string>) {
  const raw = credentials.headers
  if (!raw) {
    return {}
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('Additional MCP headers must be a JSON object.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Additional MCP headers must be a JSON object.')
  }
  const headers: Record<string, string> = {}
  for (const [name, item] of Object.entries(value)) {
    if (typeof item !== 'string') {
      throw new Error(`MCP header "${name}" must have a string value.`)
    }
    headers[name] = item
  }
  return headers
}

function emitChanged(sourceId: string) {
  for (const listener of changeListeners.get(sourceId) ?? []) {
    listener()
  }
}

function askForJson(label: string, request: unknown, fallback: unknown) {
  const answer = window.prompt(
    `${label}\n\nRequest:\n${JSON.stringify(request, null, 2)}\n\nEdit the JSON response:`,
    JSON.stringify(fallback, null, 2),
  )
  if (answer === null) {
    return fallback
  }
  try {
    return JSON.parse(answer) as unknown
  } catch {
    throw new Error(`${label} response must be valid JSON.`)
  }
}

export async function getMcpConnection(
  sourceId: string,
  endpoint: string,
  credentials: Record<string, string>,
) {
  const credentialKey = JSON.stringify(credentials)
  const current = connections.get(sourceId)
  if (
    current &&
    current.endpoint === endpoint &&
    current.credentialKey === credentialKey
  ) {
    return current
  }
  if (current) {
    await current.transport.terminateSession().catch(() => {})
    await current.client.close().catch(() => {})
  }

  const pending = {
    trace: [] as ProtocolTraceEntry[],
    startedAt: Date.now(),
  }
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    fetch: proxyFetch(pending),
    requestInit: { headers: extraHeaders(credentials) },
    authProvider: credentials.bearerToken
      ? {
          token: async () => credentials.bearerToken,
        }
      : undefined,
  })
  const client = new Client(CLIENT_INFO, {
    versionNegotiation: { mode: 'auto' },
    inputRequired: { autoFulfill: false },
    capabilities: {
      roots: { listChanged: false },
      elicitation: {},
      sampling: {},
    },
    listChanged: {
      tools: { onChanged: () => emitChanged(sourceId) },
      prompts: { onChanged: () => emitChanged(sourceId) },
      resources: { onChanged: () => emitChanged(sourceId) },
    },
  })
  client.setRequestHandler('roots/list' as never, async (request) =>
    askForJson('MCP roots request', request, { roots: [] }) as never,
  )
  client.setRequestHandler('elicitation/create' as never, async (request) =>
    askForJson('MCP elicitation request', request, { action: 'cancel' }) as never,
  )
  client.setRequestHandler('sampling/createMessage' as never, async (request) =>
    askForJson('MCP sampling request', request, {
      role: 'assistant',
      content: { type: 'text', text: '' },
      model: 'manual-inspector-response',
      stopReason: 'endTurn',
    }) as never,
  )
  await client.connect(transport)
  const connection: McpConnection = {
    client,
    transport,
    endpoint,
    credentialKey,
    trace: pending.trace,
    startedAt: pending.startedAt,
  }

  const receive = transport.onmessage
  transport.onmessage = (message) => {
    traceEntry(connection, {
      direction: 'in',
      kind:
        'method' in message && String(message.method).startsWith('notifications/')
          ? 'notification'
          : 'jsonrpc',
      summary:
        'method' in message
          ? String(message.method)
          : 'error' in message
            ? `RPC error ${message.error.code}`
            : `RPC response ${String(message.id)}`,
      detail: jsonValue(message),
    })
    receive?.(message)
  }
  connections.set(sourceId, connection)
  return connection
}

export function traceMark(connection: McpConnection) {
  return connection.trace.length
}

export function traceSince(connection: McpConnection, mark: number) {
  return connection.trace.slice(mark)
}

export function subscribeMcpChanges(sourceId: string, listener: () => void) {
  const listeners = changeListeners.get(sourceId) ?? new Set()
  listeners.add(listener)
  changeListeners.set(sourceId, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      changeListeners.delete(sourceId)
    }
  }
}

export async function closeMcpConnection(sourceId: string) {
  const connection = connections.get(sourceId)
  connections.delete(sourceId)
  if (!connection) {
    return
  }
  await connection.transport.terminateSession().catch(() => {})
  await connection.client.close().catch(() => {})
}
