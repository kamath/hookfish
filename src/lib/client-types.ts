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

export type ClientOperation = {
  id: string
  method: HttpMethod
  path: string
  summary?: string
  description?: string
  tags: string[]
  deprecated?: boolean
  contentType?: string
  schema: JsonSchema
  uiSchema: FormUiSchema
}

export type TagGroup = {
  name: string
  description?: string
}

export type ClientApi = {
  id: string
  title: string
  version?: string
  description?: string
  specUrl: string
  servers: string[]
  operations: ClientOperation[]
  tagGroups: TagGroup[]
  authSchema?: JsonSchema
  authUiSchema?: FormUiSchema
  authStored?: boolean
}

export type ApiSummary = {
  id: string
  title: string
  version?: string
  specUrl: string
  operationCount: number
  createdAt: string
}

export type InvokeResult = {
  status: number
  statusText: string
  headers: Array<{ name: string; value: string }>
  body: string
  elapsedMs: number
  url: string
  method: string
}
