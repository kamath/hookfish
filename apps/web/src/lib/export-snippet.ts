import { jsonSchemaToZod } from 'json-schema-to-zod'
import type { AuthScheme, Executable, JsonSchema } from './client-types'
import { asRecord } from './build-request'
import type { InvocationContext } from './executable-adapters'
import type { ExecuteRequest } from './invoke'

function headerList(request: ExecuteRequest): Array<[string, string]> {
  return Object.entries(request.headers ?? {}).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[0].toLowerCase() !== 'content-length',
  )
}

function contentType(request: ExecuteRequest): string {
  for (const [name, value] of headerList(request)) {
    if (name.toLowerCase() === 'content-type') {
      return value
    }
  }
  return ''
}

function jsonBody(request: ExecuteRequest): unknown {
  if (!request.body || !contentType(request).includes('json')) {
    return undefined
  }
  try {
    return JSON.parse(request.body)
  } catch {
    return undefined
  }
}

function jsProperty(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}

export function authPlaceholder(key: string): string {
  const token = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase()
  return `INSERT_${token || 'KEY'}`
}

export function withAuthPlaceholders(
  auth: Record<string, string>,
  keys: readonly string[],
): Record<string, string> {
  const next = { ...auth }
  for (const key of keys) {
    if (!next[key]?.trim()) {
      next[key] = authPlaceholder(key)
    }
  }
  return next
}

export function toFetch(request: ExecuteRequest): string {
  const options: string[] = []
  if (request.method !== 'GET') {
    options.push(`  method: ${JSON.stringify(request.method)},`)
  }

  const headers = headerList(request)
  if (headers.length > 0) {
    options.push('  headers: {')
    for (const [name, value] of headers) {
      options.push(`    ${jsProperty(name)}: ${JSON.stringify(value)},`)
    }
    options.push('  },')
  }

  if (request.body) {
    const json = jsonBody(request)
    if (json === undefined) {
      options.push(`  body: ${JSON.stringify(request.body)},`)
    } else {
      const pretty = JSON.stringify(json, null, 2).replace(/\n/g, '\n  ')
      options.push(`  body: JSON.stringify(${pretty}),`)
    }
  }

  if (options.length === 0) {
    return `fetch(${JSON.stringify(request.url)})`
  }

  return `fetch(${JSON.stringify(request.url)}, {\n${options.join('\n')}\n})`
}

export function snippetBaseName(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? []
  if (words.length === 0) {
    return 'operation'
  }
  const camel = words
    .map((word, index) =>
      index === 0
        ? word[0]!.toLowerCase() + word.slice(1)
        : word[0]!.toUpperCase() + word.slice(1),
    )
    .join('')
  return /^[A-Za-z_$]/.test(camel) ? camel : `operation${camel}`
}

export function executableSnippetName(executable: Executable): string {
  const raw =
    executable.binding.type === 'mcp' ? executable.name : executable.id
  return snippetBaseName(raw)
}

function asSchemaRecord(schema: unknown): Record<string, unknown> {
  return schema && typeof schema === 'object' && !Array.isArray(schema)
    ? { ...(schema as Record<string, unknown>) }
    : { type: 'object', additionalProperties: true }
}

function lookupDef(
  defs: Record<string, unknown>,
  ref: string,
): unknown {
  const match = ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/)
  if (!match) {
    return undefined
  }
  return defs[match[1]!]
}

function inlineJsonSchema(schema: JsonSchema): Record<string, unknown> {
  const root = asSchemaRecord(schema)
  const defs = asSchemaRecord(root.$defs ?? root.definitions)

  const walk = (node: unknown, stack: string[]): unknown => {
    if (Array.isArray(node)) {
      return node.map((item) => walk(item, stack))
    }
    if (!node || typeof node !== 'object') {
      return node
    }
    const record = node as Record<string, unknown>
    if (typeof record.$ref === 'string') {
      const ref = record.$ref
      const target = lookupDef(defs, ref)
      if (target !== undefined && !stack.includes(ref)) {
        const { $ref: _ref, ...rest } = record
        const resolved = walk(target, [...stack, ref])
        return Object.keys(rest).length
          ? {
              ...(typeof resolved === 'object' && resolved && !Array.isArray(resolved)
                ? resolved
                : {}),
              ...Object.fromEntries(
                Object.entries(rest).map(([key, value]) => [key, walk(value, stack)]),
              ),
            }
          : resolved
      }
    }
    return Object.fromEntries(
      Object.entries(record)
        .filter(([key]) => key !== '$defs' && key !== 'definitions')
        .map(([key, value]) => [key, walk(value, stack)]),
    )
  }

  return asSchemaRecord(walk(root, []))
}

function zodSchemaConst(name: string, schema: JsonSchema): string {
  return jsonSchemaToZod(inlineJsonSchema(schema), {
    name,
    module: 'none',
    zodVersion: 4,
  })
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

export function withZodExport(options: {
  name: string
  inputSchema: JsonSchema
  outputSchema?: JsonSchema
  imports?: string[]
  setup?: string
  input?: unknown
  result: (outputSchemaName?: string) => string
}): string {
  const base = snippetBaseName(options.name)
  const inputName = `${base}InputSchema`
  const outputName = `${base}OutputSchema`
  const outputConst = options.outputSchema
    ? zodSchemaConst(outputName, options.outputSchema)
    : undefined

  const blocks = [
    ['import { z } from "zod"', ...(options.imports ?? [])].join('\n'),
    zodSchemaConst(inputName, options.inputSchema),
    outputConst,
    `const input = ${inputName}.parse(${prettyJson(options.input)})`,
    options.setup,
    options.result(outputConst ? outputName : undefined),
  ].filter((block): block is string => Boolean(block))

  return blocks.join('\n\n')
}

function schemaHasValidation(schema: unknown): schema is JsonSchema {
  return (
    Boolean(schema) &&
    typeof schema === 'object' &&
    !Array.isArray(schema) &&
    Object.keys(schema as JsonSchema).some(
      (key) => key !== 'title' && key !== 'description',
    )
  )
}

function httpBodyOutputSchema(schema?: JsonSchema): JsonSchema | undefined {
  const variants = Object.values(asRecord(schema?.properties)).filter(
    schemaHasValidation,
  )
  if (variants.length === 0) {
    return undefined
  }
  return variants.length === 1 ? variants[0] : { oneOf: variants }
}

function authParameterNames(context: InvocationContext) {
  const locations = {
    query: new Set<string>(),
    header: new Set<string>(),
    cookie: new Set<string>(),
  }
  const rawSchemes = asRecord(context.source.adapterData).authSchemes
  const schemes = Array.isArray(rawSchemes) ? (rawSchemes as AuthScheme[]) : []
  for (const scheme of schemes) {
    if (scheme.type === 'apiKey') {
      const location = scheme.in === 'query' || scheme.in === 'cookie'
        ? scheme.in
        : 'header'
      const name = scheme.key ?? scheme.name
      locations[location].add(location === 'header' ? name.toLowerCase() : name)
    } else {
      locations.header.add('authorization')
    }
  }
  return locations
}

function staticQuery(request: ExecuteRequest, context: InvocationContext) {
  const url = new URL(request.url)
  const protectedNames = authParameterNames(context).query
  const dynamicNames = new Set(
    Object.keys(asRecord(asRecord(context.formData).query)).filter(
      (name) => !protectedNames.has(name),
    ),
  )
  return Array.from(url.searchParams.entries()).filter(
    ([name]) => !dynamicNames.has(name),
  )
}

function staticHeaders(request: ExecuteRequest, context: InvocationContext) {
  const protectedNames = authParameterNames(context).header
  const dynamicNames = new Set(
    Object.keys(asRecord(asRecord(context.formData).header))
      .map((name) => name.toLowerCase())
      .filter((name) => !protectedNames.has(name)),
  )
  dynamicNames.add('cookie')
  return Object.fromEntries(
    headerList(request).filter(([name]) => !dynamicNames.has(name.toLowerCase())),
  )
}

function staticCookies(request: ExecuteRequest, context: InvocationContext) {
  const protectedNames = authParameterNames(context).cookie
  const dynamicNames = new Set(
    Object.keys(asRecord(asRecord(context.formData).cookie)).filter(
      (name) => !protectedNames.has(name),
    ),
  )
  const cookie = headerList(request).find(
    ([name]) => name.toLowerCase() === 'cookie',
  )?.[1]
  return (cookie ?? '')
    .split(/;\s*|,\s*(?=[^;,]+=)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf('=')
      return separator < 0
        ? [part, '']
        : [part.slice(0, separator), part.slice(separator + 1)]
    })
    .filter(([name]) => !dynamicNames.has(name)) as Array<[string, string]>
}

function httpSetup(
  request: ExecuteRequest,
  context: InvocationContext,
): string {
  const binding = context.executable.binding
  if (binding.type !== 'http' || typeof binding.path !== 'string') {
    throw new Error('Expected an HTTP executable.')
  }
  const query = staticQuery(request, context)
  const headers = staticHeaders(request, context)
  const cookies = staticCookies(request, context)
  const authNames = authParameterNames(context)
  const setup = [
    `const path = ${JSON.stringify(binding.path)}.replace(/\\{([^}]+)\\}/g, (_, name) => {
  const value = input.path?.[name]
  return value === undefined || value === null || value === ''
    ? \`{\${name}}\`
    : encodeURIComponent(String(value))
})`,
    `const url = new URL(${JSON.stringify(context.target.replace(/\/$/, ''))} + (path.startsWith('/') ? '' : '/') + path)`,
  ]

  for (const [name, value] of query) {
    setup.push(
      `url.searchParams.append(${JSON.stringify(name)}, ${JSON.stringify(value)})`,
    )
  }
  setup.push(`const authQueryNames = new Set(${prettyJson([...authNames.query])})
for (const [name, value] of Object.entries(input.query ?? {})) {
  if (authQueryNames.has(name)) continue
  for (const item of Array.isArray(value) ? value : [value]) {
    if (item !== undefined && item !== null && item !== '') {
      url.searchParams.append(name, String(item))
    }
  }
}`)
  setup.push(`const headers = new Headers(${prettyJson(headers)})`)
  setup.push(`const authHeaderNames = new Set(${prettyJson([...authNames.header])})
for (const [name, value] of Object.entries(input.header ?? {})) {
  if (authHeaderNames.has(name.toLowerCase())) continue
  if (value !== undefined && value !== null && value !== '') {
    headers.set(name, String(value))
  }
}`)
  setup.push(`const cookies = new Map(${prettyJson(cookies)})
const authCookieNames = new Set(${prettyJson([...authNames.cookie])})
for (const [name, value] of Object.entries(input.cookie ?? {})) {
  if (authCookieNames.has(name)) continue
  if (value !== undefined && value !== null && value !== '') {
    cookies.set(name, String(value))
  }
}
if (cookies.size > 0) {
  headers.set('Cookie', Array.from(cookies, ([name, value]) => \`\${name}=\${value}\`).join('; '))
}`)
  return setup.join('\n\n')
}

function httpFetchExpression(
  request: ExecuteRequest,
): string {
  const options = [`method: ${JSON.stringify(request.method)}`, 'headers']
  if (request.body !== undefined) {
    options.push(
      contentType(request).includes('application/x-www-form-urlencoded')
        ? `body: new URLSearchParams(
    Object.entries(input.body ?? {}).map(([name, value]) => [name, String(value)]),
  )`
        : 'body: JSON.stringify(input.body)',
    )
  }
  return `fetch(url, {\n  ${options.join(',\n  ')},\n})`
}

export function toHttpExportSnippet(
  request: ExecuteRequest,
  context: InvocationContext,
): string {
  const outputSchema = httpBodyOutputSchema(context.executable.outputSchema)
  const fetchCall = httpFetchExpression(request)
  return withZodExport({
    name: executableSnippetName(context.executable),
    inputSchema: context.executable.inputSchema,
    outputSchema,
    setup: httpSetup(request, context),
    input: context.formData,
    result: (outputSchemaName) =>
      outputSchemaName
        ? `const response = await ${fetchCall}
const output = response.headers.get('content-type')?.includes('json')
  ? await response.json()
  : await response.text()
const result = ${outputSchemaName}.parse(output)`
        : `const result = await ${fetchCall}`,
  })
}
