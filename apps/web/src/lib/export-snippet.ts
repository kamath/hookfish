import { jsonSchemaToZod } from 'json-schema-to-zod'
import type { Executable, JsonSchema } from './client-types'
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
  try {
    return jsonSchemaToZod(inlineJsonSchema(schema), {
      name,
      module: 'none',
      zodVersion: 4,
    })
  } catch {
    return `const ${name} = z.unknown()`
  }
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
  expression: string
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
    options.setup,
    [
      `const input = ${inputName}.parse(${prettyJson(options.input)})`,
      outputConst
        ? `const result = ${outputName}.parse(await ${options.expression})`
        : `const result = await ${options.expression}`,
    ].join('\n'),
  ].filter((block): block is string => Boolean(block))

  return blocks.join('\n\n')
}

export function toHttpExportSnippet(
  request: ExecuteRequest,
  executable: Executable,
  formData?: unknown,
): string {
  const fetchCall = toFetch(request)
  return withZodExport({
    name: executableSnippetName(executable),
    inputSchema: executable.inputSchema,
    outputSchema: executable.outputSchema,
    input: formData,
    expression: executable.outputSchema
      ? `(await ${fetchCall}).json()`
      : fetchCall,
  })
}
