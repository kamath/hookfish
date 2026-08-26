import { parse as parseYaml } from 'yaml'
import type {
  ClientApi,
  ClientOperation,
  FormUiSchema,
  HttpMethod,
  JsonSchema,
  TagGroup,
} from './client-types'
import { isHttpUrl } from './build-request'

const METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]

const MAX_SPEC_BYTES = 2_000_000

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function decodePointer(part: string): string {
  return part.replace(/~1/g, '/').replace(/~0/g, '~')
}

function resolveRef(root: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local $ref values are supported (${ref}).`)
  }

  const parts = ref.slice(2).split('/').map(decodePointer)
  let current: unknown = root

  for (const part of parts) {
    if (!isObject(current) && !Array.isArray(current)) {
      throw new Error(`Could not resolve ${ref}.`)
    }
    current = Array.isArray(current)
      ? current[Number(part)]
      : (current as Json)[part]
  }

  if (current === undefined) {
    throw new Error(`Could not resolve ${ref}.`)
  }

  return current
}

function deref(node: unknown, root: unknown, stack: string[] = []): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => deref(item, root, stack))
  }

  if (!isObject(node)) {
    return node
  }

  if (typeof node.$ref === 'string') {
    if (stack.includes(node.$ref)) {
      return { type: 'object', title: 'Circular reference' }
    }
    const { $ref, ...rest } = node
    const resolved = deref(resolveRef(root, $ref), root, [...stack, $ref])
    return isObject(resolved) ? { ...resolved, ...rest } : resolved
  }

  const next: Json = {}
  for (const [key, value] of Object.entries(node)) {
    next[key] = deref(value, root, stack)
  }
  return next
}

function rewriteRefs(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(rewriteRefs)
  }

  if (!isObject(node)) {
    return node
  }

  const next: Json = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      next[key] = value
        .replace('#/components/schemas/', '#/$defs/')
        .replace('#/definitions/', '#/$defs/')
      continue
    }
    next[key] = rewriteRefs(value)
  }
  return next
}

function oasToJsonSchema(schema: unknown): JsonSchema {
  if (!isObject(schema)) {
    return { type: 'string' }
  }

  const next: Json = { ...schema }

  if (next.nullable === true) {
    delete next.nullable
    if (typeof next.type === 'string') {
      next.type = [next.type, 'null']
    } else if (!next.type) {
      next.type = ['object', 'null']
    }
  }

  if (next.exclusiveMinimum === true && typeof next.minimum === 'number') {
    next.exclusiveMinimum = next.minimum
    delete next.minimum
  }

  if (next.exclusiveMaximum === true && typeof next.maximum === 'number') {
    next.exclusiveMaximum = next.maximum
    delete next.maximum
  }

  if (isObject(next.properties)) {
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [
        key,
        oasToJsonSchema(value),
      ]),
    )
  }

  if (next.items) {
    next.items = Array.isArray(next.items)
      ? next.items.map(oasToJsonSchema)
      : oasToJsonSchema(next.items)
  }

  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (Array.isArray(next[key])) {
      next[key] = (next[key] as unknown[]).map(oasToJsonSchema)
    }
  }

  if (isObject(next.additionalProperties)) {
    next.additionalProperties = oasToJsonSchema(next.additionalProperties)
  }

  return rewriteRefs(next) as JsonSchema
}

function collectDefs(root: Json): Record<string, JsonSchema> {
  const source =
    (isObject(root.components) && isObject(root.components.schemas)
      ? root.components.schemas
      : undefined) ?? (isObject(root.definitions) ? root.definitions : undefined)

  if (!source) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, oasToJsonSchema(value)]),
  )
}

function parameterSchema(param: Json, root: unknown): JsonSchema {
  const raw = param.schema ?? {
    type: param.type,
    format: param.format,
    enum: param.enum,
    items: param.items,
    default: param.default,
  }
  const schema = oasToJsonSchema(deref(raw, root))
  if (!schema.title) {
    schema.title = String(param.name ?? 'value')
  }
  if (!schema.description && typeof param.description === 'string') {
    schema.description = param.description
  }
  return schema
}

function resolveParam(param: unknown, root: unknown): Json {
  const node = isObject(param) ? param : {}
  const resolved = isObject(deref(node, root)) ? (deref(node, root) as Json) : node
  return resolved
}

function mergeParameters(
  pathItem: Json,
  operation: Json,
  root: unknown,
): Json[] {
  const merged = new Map<string, Json>()

  for (const raw of [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ]) {
    const param = resolveParam(raw, root)
    const key = `${String(param.in)}:${String(param.name)}`
    merged.set(key, param)
  }

  return [...merged.values()]
}

function requestBodySchema(
  operation: Json,
  root: unknown,
): { schema: JsonSchema; contentType: string; required?: boolean } | undefined {
  if (isObject(operation.requestBody)) {
    const body = deref(operation.requestBody, root)
    if (!isObject(body) || !isObject(body.content)) {
      return undefined
    }

    const content = body.content
    const preferred =
      (isObject(content['application/json']) && 'application/json') ||
      (isObject(content['application/x-www-form-urlencoded']) &&
        'application/x-www-form-urlencoded') ||
      Object.keys(content)[0]

    if (!preferred || !isObject(content[preferred])) {
      return undefined
    }

    const media = content[preferred]
    if (!media.schema) {
      return {
        schema: { type: 'object', title: 'Body' },
        contentType: preferred,
        required: body.required === true,
      }
    }

    return {
      schema: {
        ...oasToJsonSchema(deref(media.schema, root)),
        title: 'Body',
      },
      contentType: preferred,
      required: body.required === true,
    }
  }

  const bodyParam = (Array.isArray(operation.parameters) ? operation.parameters : [])
    .map((param) => resolveParam(param, root))
    .find((param) => param.in === 'body')

  if (bodyParam) {
    return {
      schema: {
        ...parameterSchema(bodyParam, root),
        title: 'Body',
      },
      contentType: 'application/json',
      required: Boolean(bodyParam.required),
    }
  }

  const formParams = (Array.isArray(operation.parameters) ? operation.parameters : [])
    .map((param) => resolveParam(param, root))
    .filter((param) => param.in === 'formData')

  if (formParams.length > 0) {
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []
    for (const param of formParams) {
      const name = String(param.name)
      properties[name] = parameterSchema(param, root)
      if (param.required) {
        required.push(name)
      }
    }
    return {
      schema: {
        type: 'object',
        title: 'Body',
        properties,
        required,
      },
      contentType: 'application/x-www-form-urlencoded',
      required: required.length > 0,
    }
  }

  return undefined
}

function collectSecurityNames(root: Json): Set<string> {
  const names = new Set<string>()

  function add(requirement: unknown) {
    if (!Array.isArray(requirement)) {
      return
    }
    for (const item of requirement) {
      if (isObject(item)) {
        for (const name of Object.keys(item)) {
          names.add(name)
        }
      }
    }
  }

  add(root.security)

  const paths = isObject(root.paths) ? root.paths : {}
  for (const rawPath of Object.values(paths)) {
    if (!isObject(rawPath)) {
      continue
    }
    const pathItem = deref(rawPath, root)
    if (!isObject(pathItem)) {
      continue
    }
    add(pathItem.security)
    for (const method of METHODS) {
      const operation = pathItem[method]
      if (isObject(operation)) {
        add(operation.security)
      }
    }
  }

  return names
}

function specAuthFields(root: Json): JsonSchema | undefined {
  const schemes = isObject(root.components)
    ? root.components.securitySchemes
    : root.securityDefinitions
  if (!isObject(schemes)) {
    return undefined
  }

  const used = collectSecurityNames(root)
  const names = used.size > 0 ? used : new Set(Object.keys(schemes))

  const properties: Record<string, JsonSchema> = {}
  for (const name of names) {
    const scheme = deref(schemes[name], root)
    if (!isObject(scheme)) {
      continue
    }

    const type = String(scheme.type ?? '')
    if (type === 'http' && scheme.scheme === 'basic') {
      properties[`${name}.username`] = {
        type: 'string',
        title: `${name} username`,
      }
      properties[`${name}.password`] = {
        type: 'string',
        title: `${name} password`,
      }
      continue
    }

    properties[name] = {
      type: 'string',
      title:
        type === 'apiKey'
          ? `${name} (${String(scheme.in ?? 'header')}: ${String(scheme.name ?? name)})`
          : `${name} token`,
    }
  }

  if (Object.keys(properties).length === 0) {
    return undefined
  }

  return {
    type: 'object',
    title: 'Auth',
    properties,
  }
}

function authUiSchema(schema: JsonSchema | undefined): FormUiSchema {
  if (!schema?.properties) {
    return {}
  }

  const ui: FormUiSchema = {}
  for (const key of Object.keys(schema.properties)) {
    ui[key] = { 'ui:widget': 'password', 'ui:autocomplete': 'off' }
  }
  return ui
}

function groupTitle(location: string): string {
  switch (location) {
    case 'path':
      return 'Path'
    case 'query':
      return 'Additional Params'
    case 'header':
      return 'Headers'
    case 'cookie':
      return 'Cookies'
    default:
      return location
  }
}

function operationToForm(
  pathItem: Json,
  operation: Json,
  root: Json,
  defs: Record<string, JsonSchema>,
): { schema: JsonSchema; uiSchema: FormUiSchema; contentType?: string } {
  const properties: Record<string, JsonSchema> = {}
  const requiredGroups: string[] = []
  const uiSchema: FormUiSchema = {
    'ui:submitButtonOptions': { norender: true },
    'ui:options': { autocomplete: 'off' },
  }

  const groups: Record<string, Record<string, JsonSchema>> = {
    path: {},
    query: {},
    header: {},
    cookie: {},
  }
  const requiredByGroup: Record<string, string[]> = {
    path: [],
    query: [],
    header: [],
    cookie: [],
  }

  for (const param of mergeParameters(pathItem, operation, root)) {
    const location = String(param.in)
    if (!groups[location] || !param.name) {
      continue
    }
    const name = String(param.name)
    groups[location][name] = parameterSchema(param, root)
    if (param.required || location === 'path') {
      requiredByGroup[location]?.push(name)
    }
  }

  for (const location of Object.keys(groups)) {
    const groupProperties = groups[location]
    if (!groupProperties || Object.keys(groupProperties).length === 0) {
      continue
    }
    properties[location] = {
      type: 'object',
      title: groupTitle(location),
      properties: groupProperties,
      required: requiredByGroup[location],
    }
    if ((requiredByGroup[location] ?? []).length > 0) {
      requiredGroups.push(location)
    }
  }

  const body = requestBodySchema(operation, root)
  if (body) {
    properties.body = body.schema
    if (body.required) {
      requiredGroups.push('body')
    }
  }

  return {
    schema: {
      type: 'object',
      properties,
      required: requiredGroups,
      $defs: defs,
    },
    uiSchema,
    contentType: body?.contentType,
  }
}

function serversFromSpec(root: Json, specUrl: string): string[] {
  if (Array.isArray(root.servers)) {
    const urls = root.servers
      .map((server) => (isObject(server) ? String(server.url ?? '') : ''))
      .filter((url) => url.length > 0)
    if (urls.length > 0) {
      return urls.map((url) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url.replace(/\/$/, '')
        }
        try {
          return new URL(url, specUrl).toString().replace(/\/$/, '')
        } catch {
          return url
        }
      })
    }
  }

  if (typeof root.host === 'string') {
    const schemes = Array.isArray(root.schemes)
      ? root.schemes.map(String)
      : ['https']
    const basePath = typeof root.basePath === 'string' ? root.basePath : ''
    return schemes.map(
      (scheme) => `${scheme}://${root.host}${basePath}`.replace(/\/$/, ''),
    )
  }

  return [new URL(specUrl).origin]
}

function operationIdFor(
  method: HttpMethod,
  path: string,
  operation: Json,
  used: Set<string>,
): string {
  const raw =
    typeof operation.operationId === 'string' && operation.operationId.length > 0
      ? operation.operationId
      : `${method}:${path}`

  let id = raw
  let index = 2
  while (used.has(id)) {
    id = `${raw}-${index}`
    index += 1
  }
  used.add(id)
  return id
}

export function specToClient(spec: unknown, specUrl: string, id: string): ClientApi {
  if (!isObject(spec)) {
    throw new Error('The document is not a valid OpenAPI object.')
  }

  const isOpenApi =
    typeof spec.openapi === 'string' ||
    spec.swagger === '2.0' ||
    isObject(spec.paths)

  if (!isOpenApi) {
    throw new Error('The URL did not return an OpenAPI or Swagger document.')
  }

  const info = isObject(spec.info) ? spec.info : {}
  const paths = isObject(spec.paths) ? spec.paths : {}
  const defs = collectDefs(spec)
  const usedIds = new Set<string>()
  const operations: ClientOperation[] = []

  for (const [path, rawPathItem] of Object.entries(paths)) {
    if (path.startsWith('x-') || !isObject(rawPathItem)) {
      continue
    }

    const pathItem = deref(rawPathItem, spec) as Json

    for (const method of METHODS) {
      const operation = pathItem[method]
      if (!isObject(operation)) {
        continue
      }

      const form = operationToForm(pathItem, operation, spec, defs)
      const tags = Array.isArray(operation.tags)
        ? operation.tags.map(String)
        : []

      operations.push({
        id: operationIdFor(method, path, operation, usedIds),
        method,
        path,
        summary:
          typeof operation.summary === 'string' ? operation.summary : undefined,
        description:
          typeof operation.description === 'string'
            ? operation.description
            : undefined,
        tags,
        deprecated: operation.deprecated === true,
        contentType: form.contentType,
        schema: form.schema,
        uiSchema: form.uiSchema,
      })
    }
  }

  if (operations.length === 0) {
    throw new Error('No operations were found in this spec.')
  }

  const authSchema = specAuthFields(spec)

  return {
    id,
    title:
      typeof info.title === 'string' && info.title.length > 0
        ? info.title
        : new URL(specUrl).hostname,
    version: typeof info.version === 'string' ? info.version : undefined,
    description:
      typeof info.description === 'string' ? info.description : undefined,
    specUrl,
    servers: serversFromSpec(spec, specUrl),
    operations,
    tagGroups: tagsFromSpec(spec, operations),
    authSchema,
    authUiSchema: authUiSchema(authSchema),
  }
}

function tagsFromSpec(root: Json, operations: ClientOperation[]): TagGroup[] {
  const described = new Map<string, string | undefined>()
  if (Array.isArray(root.tags)) {
    for (const tag of root.tags) {
      if (!isObject(tag) || typeof tag.name !== 'string' || tag.name.length === 0) {
        continue
      }
      described.set(
        tag.name,
        typeof tag.description === 'string' ? tag.description : undefined,
      )
    }
  }

  const names: string[] = []
  for (const name of described.keys()) {
    names.push(name)
  }
  for (const operation of operations) {
    for (const name of operation.tags) {
      if (!names.includes(name)) {
        names.push(name)
      }
    }
  }

  return names.map((name) => ({
    name,
    description: described.get(name),
  }))
}

export async function fetchSpec(specUrl: string): Promise<unknown> {
  if (!isHttpUrl(specUrl)) {
    throw new Error('Enter an http or https OpenAPI URL.')
  }

  const response = await fetch(specUrl, {
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, text/plain, */*',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Could not fetch the spec (${response.status}).`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_SPEC_BYTES) {
    throw new Error('The spec is larger than 2 MB.')
  }

  const text = new TextDecoder().decode(buffer).trim()
  if (!text) {
    throw new Error('The spec was empty.')
  }

  try {
    if (text.startsWith('{') || text.startsWith('[')) {
      return JSON.parse(text)
    }
    return parseYaml(text)
  } catch {
    throw new Error('The response was not valid JSON or YAML.')
  }
}

export function findOperation(
  spec: unknown,
  specUrl: string,
  operationId: string,
): ClientOperation {
  const client = specToClient(spec, specUrl, 'tmp')
  const operation = client.operations.find((item) => item.id === operationId)
  if (!operation) {
    throw new Error('That operation is not in this spec.')
  }
  return operation
}

export function applyAuth(
  headers: Headers,
  url: URL,
  spec: unknown,
  formAuth: Record<string, unknown>,
) {
  if (!isObject(spec)) {
    return
  }

  const schemes = isObject(spec.components)
    ? spec.components.securitySchemes
    : spec.securityDefinitions
  if (!isObject(schemes)) {
    return
  }

  for (const [name, rawScheme] of Object.entries(schemes)) {
    const scheme = isObject(rawScheme) ? rawScheme : {}
    const type = String(scheme.type ?? '')
    const token = formAuth[name]

    if (type === 'http' && scheme.scheme === 'basic') {
      const username = formAuth[`${name}.username`]
      const password = formAuth[`${name}.password`]
      if (typeof username === 'string' && typeof password === 'string') {
        headers.set(
          'Authorization',
          `Basic ${btoa(`${username}:${password}`)}`,
        )
      }
      continue
    }

    if (typeof token !== 'string' || token.length === 0) {
      continue
    }

    if (type === 'apiKey') {
      const location = String(scheme.in ?? 'header')
      const key = String(scheme.name ?? name)
      if (location === 'query') {
        url.searchParams.set(key, token)
      } else if (location === 'cookie') {
        headers.append('Cookie', `${key}=${token}`)
      } else {
        headers.set(key, token)
      }
      continue
    }

    if (type === 'http' && scheme.scheme === 'bearer') {
      headers.set('Authorization', `Bearer ${token}`)
      continue
    }

    headers.set('Authorization', token)
  }
}
