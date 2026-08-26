export type JsonSchema = Record<string, unknown>

export type FormUiSchema = Record<string, unknown>

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

export type ExecutableBinding = HttpBinding | ({ type: string } & Record<string, unknown>)

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
}

// Compatibility aliases for the OpenAPI storage and parser modules. UI code should
// consume the protocol-neutral names above.
export type ClientOperation = Executable
export type TagGroup = ExecutableGroup
export type ClientApi = ExecutableSource
export type ApiSummary = SourceSummary
export type InvokeResult = ExecutionResult
