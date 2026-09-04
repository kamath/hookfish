import { isHttpUrl } from './http'

type Json = Record<string, unknown>

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const

function isObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isOpenApiDocument(value: unknown): value is Json {
  if (!isObject(value)) {
    return false
  }
  if (typeof value.openapi === 'string' || typeof value.swagger === 'string') {
    return true
  }
  return isObject(value.info) && isObject(value.paths)
}

function decodePointer(part: string): string {
  return part.replace(/~1/g, '/').replace(/~0/g, '~')
}

function resolveRef(root: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local $ref values are supported (${ref}).`)
  }

  let current: unknown = root
  for (const part of ref.slice(2).split('/').map(decodePointer)) {
    if (Array.isArray(current)) {
      current = current[Number(part)]
    } else if (isObject(current)) {
      current = current[part]
    } else {
      throw new Error(`Could not resolve ${ref}.`)
    }
  }

  if (current === undefined) {
    throw new Error(`Could not resolve ${ref}.`)
  }
  return current
}

function deref(node: unknown, root: unknown, stack: string[] = []): unknown {
  if (!isObject(node) || typeof node.$ref !== 'string') {
    return node
  }
  if (stack.includes(node.$ref)) {
    throw new Error(`Could not resolve ${node.$ref}.`)
  }
  return deref(resolveRef(root, node.$ref), root, [...stack, node.$ref])
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wildcardPattern(value: string) {
  return value.split(/\{[^}]+\}/).map(escapeRegExp).join('[^/]+')
}

export function resolveSpecUrl(specUrl: string, baseUrl?: string): string {
  try {
    return new URL(specUrl, baseUrl || specUrl).href
  } catch {
    throw new Error('Enter an http or https OpenAPI URL.')
  }
}

function resolveServerUrl(server: string, specUrl: string): string {
  const trimmed = server.trim()
  if (!trimmed) {
    return new URL(specUrl).origin
  }
  try {
    return new URL(trimmed).href
  } catch {
    return new URL(trimmed, specUrl).href
  }
}

function serverUrlsFrom(node: unknown): string[] | undefined {
  if (!isObject(node) || !Array.isArray(node.servers)) {
    return undefined
  }
  const urls = node.servers.flatMap((server) => {
    if (!isObject(server) || typeof server.url !== 'string' || !server.url.trim()) {
      return []
    }
    return [server.url]
  })
  return urls.length > 0 ? urls : undefined
}

function oas2ServerUrls(root: Json): string[] | undefined {
  if (typeof root.host !== 'string' || !root.host.trim()) {
    return undefined
  }
  const schemes = Array.isArray(root.schemes) && root.schemes.length > 0
    ? root.schemes.map(String)
    : ['https']
  const basePath = typeof root.basePath === 'string' ? root.basePath : ''
  return schemes.map((scheme) => `${scheme}://${root.host}${basePath}`)
}

function serversForOperation(
  root: Json,
  pathItem: Json,
  operation: Json,
  specUrl: string,
): string[] {
  const listed =
    serverUrlsFrom(operation) ??
    serverUrlsFrom(pathItem) ??
    serverUrlsFrom(root) ??
    oas2ServerUrls(root)
  if (listed) {
    return listed.map((server) => resolveServerUrl(server, specUrl))
  }
  return [new URL(specUrl).origin]
}

function pathRemainder(requestUrl: string, serverHref: string): string | undefined {
  const prefix = serverHref.split('#')[0]?.split('?')[0]?.replace(/\/$/, '') ?? ''
  const request = requestUrl.split('#')[0]?.split('?')[0]?.replace(/\/$/, '') ?? ''
  if (!prefix) {
    return undefined
  }
  const match = request.match(new RegExp(`^${wildcardPattern(prefix)}(?<rest>/.*)?$`, 'i'))
  if (!match) {
    return undefined
  }
  return match.groups?.rest ?? '/'
}

function pathMatches(template: string, actual: string): boolean {
  const normalizedTemplate = template.replace(/\/$/, '') || '/'
  const normalizedActual = actual.replace(/\/$/, '') || '/'
  return new RegExp(`^${wildcardPattern(normalizedTemplate)}$`).test(normalizedActual)
}

function operationsInSpec(spec: Json) {
  const paths = isObject(spec.paths) ? spec.paths : {}
  return Object.entries(paths).flatMap(([path, rawPathItem]) => {
    if (path.startsWith('x-')) {
      return []
    }
    const pathItem = deref(rawPathItem, spec)
    if (!isObject(pathItem)) {
      return []
    }
    return HTTP_METHODS.flatMap((method) => {
      const operation = deref(pathItem[method], spec)
      if (!isObject(operation)) {
        return []
      }
      return [{ path, method, pathItem, operation }]
    })
  })
}

export function assertHttpRequestMatchesSpec(
  spec: unknown,
  specUrl: string,
  request: { method: string; url: string },
  baseUrl?: string,
) {
  if (!isOpenApiDocument(spec)) {
    throw new Error('The spec URL did not return an OpenAPI or Swagger document.')
  }
  if (!isHttpUrl(request.url)) {
    throw new Error('Choose an http or https URL.')
  }

  const resolvedSpecUrl = resolveSpecUrl(specUrl, baseUrl)
  const method = request.method.trim().toLowerCase()
  const allowed = operationsInSpec(spec).some((operation) => {
    if (operation.method !== method) {
      return false
    }
    return serversForOperation(
      spec,
      operation.pathItem,
      operation.operation,
      resolvedSpecUrl,
    ).some((server) => {
      const remainder = pathRemainder(request.url, server)
      return remainder !== undefined && pathMatches(operation.path, remainder)
    })
  })

  if (!allowed) {
    throw new Error('The request does not match an operation in this spec.')
  }
}
