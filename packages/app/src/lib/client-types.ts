export type JsonSchema = Record<string, unknown>

export type FormUiSchema = Record<string, unknown>

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'head'
  | 'options'

export type HttpBinding = {
  type: 'http'
  method: HttpMethod
  path: string
  contentType?: string
}

export type McpBinding = {
  type: 'mcp'
  kind: 'tool' | 'resource' | 'resource-template' | 'prompt'
  method: 'tools/call' | 'resources/read' | 'prompts/get'
  name: string
  headerParameters?: Array<{
    path: string[]
    header: string
  }>
}

export type ExecutableBinding =
  | HttpBinding
  | McpBinding
  | ({ type: string } & Record<string, unknown>)

// Protocol-neutral rendering of hints an executable advertises about itself,
// such as MCP tool annotations.
export type ExecutableAnnotation = {
  label: string
  detail?: string
}

export type Executable = {
  id: string
  name: string
  badge: string
  accent: string
  summary?: string
  description?: string
  groups: string[]
  deprecated?: boolean
  binding: ExecutableBinding
  inputSchema: JsonSchema
  inputUiSchema: FormUiSchema
  outputSchema?: JsonSchema
  annotations?: ExecutableAnnotation[]
}

export type ExecutableGroup = {
  name: string
  description?: string
}

export type AuthScheme = {
  name: string
  type: string
  scheme?: string
  in?: string
  key?: string
}

export type SourceLabels = {
  source: string
  sourcePlural: string
  executable: string
  executablePlural: string
  target: string
  execute: string
  executing: string
  executed: string
  export?: string
  exported?: string
}

export type ExecutableSource = {
  id: string
  kind: string
  title: string
  version?: string
  description?: string
  sourceUrl: string
  targets: string[]
  executables: Executable[]
  groups: ExecutableGroup[]
  labels: SourceLabels
  adapterData?: unknown
  credentialSchema?: JsonSchema
  credentialUiSchema?: FormUiSchema
  credentialsRequired?: boolean
  credentialsStored?: boolean
}

export type SourceSummary = {
  id: string
  kind: string
  title: string
  version?: string
  sourceUrl: string
  executableCount: number
  createdAt: string
  cache?: boolean
}

export type ExecutionResult = {
  status?: {
    code?: number
    text: string
  }
  details?: {
    label: string
    items: Array<{ name: string; value: string }>
  }
  body: string
  elapsedMs: number
  target?: string
  action?: string
  trace?: ProtocolTraceEntry[]
  inputRequired?: {
    requests: Record<string, JsonValue>
    requestState?: string
  }
}

export type ProtocolTraceEntry = {
  atMs: number
  direction: 'out' | 'in'
  kind: 'http' | 'jsonrpc' | 'sse' | 'notification'
  summary: string
  detail?: JsonValue
}
// Compatibility aliases for the OpenAPI storage and parser modules. UI code should
// consume the protocol-neutral names above.
export type ClientOperation = Executable
export type TagGroup = ExecutableGroup
export type ClientApi = ExecutableSource
export type ApiSummary = SourceSummary
export type InvokeResult = ExecutionResult
