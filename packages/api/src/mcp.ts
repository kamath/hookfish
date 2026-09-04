function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isJsonRpcMessage(value: unknown): boolean {
  if (!isObject(value) || value.jsonrpc !== '2.0') {
    return false
  }

  const hasMethod = typeof value.method === 'string' && value.method.length > 0
  const hasResult = 'result' in value
  const hasError = 'error' in value
  if (hasMethod && !hasResult && !hasError) {
    return true
  }
  return !hasMethod && 'id' in value && hasResult !== hasError
}

export function isMcpJsonRpcBody(body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body)
    const messages = Array.isArray(parsed) ? parsed : [parsed]
    return messages.length > 0 && messages.every(isJsonRpcMessage)
  } catch {
    return false
  }
}

export function isOAuthProtocolBody(contentType: string, body: string): boolean {
  const type = contentType.toLowerCase()
  if (type.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(body).has('grant_type')
  }
  if (!type.includes('application/json')) {
    return false
  }
  try {
    const parsed: unknown = JSON.parse(body)
    return (
      isObject(parsed) &&
      (typeof parsed.grant_type === 'string' || Array.isArray(parsed.redirect_uris))
    )
  } catch {
    return false
  }
}

export function assertMcpProxyRequest(input: {
  method: string
  contentType?: string
  body?: string
}) {
  const method = input.method.trim().toUpperCase()
  const body = input.body ?? ''

  if (method === 'GET' || method === 'DELETE') {
    if (body.trim().length > 0) {
      throw new Error('MCP GET and DELETE requests cannot include a body.')
    }
    return
  }

  if (method !== 'POST') {
    throw new Error('MCP proxy only accepts GET, POST, and DELETE.')
  }

  if (
    isMcpJsonRpcBody(body) ||
    isOAuthProtocolBody(input.contentType ?? '', body)
  ) {
    return
  }

  throw new Error('The request does not match the MCP protocol.')
}
