export type SourceKind = 'openapi' | 'mcp'

const OPENAPI_MARK = /openapi|swagger/
const MCP_HOST = /(?:^|\.)mcp(?:\.|$)/
const YAML_SPEC = /\.(?:ya?ml)$/

export function hintSourceKind(url: string): SourceKind | undefined {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const openapi = OPENAPI_MARK.test(host) || OPENAPI_MARK.test(path) || YAML_SPEC.test(path)
    const mcp = MCP_HOST.test(host) || /(?:^|\/)mcp(?:\/|$)/.test(path)
    if (openapi === mcp) {
      return undefined
    }
    return openapi ? 'openapi' : 'mcp'
  } catch {
    return undefined
  }
}

export function sourceProbeOrder(url: string): SourceKind[] {
  return hintSourceKind(url) === 'mcp' ? ['mcp', 'openapi'] : ['openapi', 'mcp']
}

export function neitherSourceError(errors: unknown[]) {
  if (
    errors.some(
      (error) => error instanceof Error && /CORS/i.test(error.message),
    )
  ) {
    return new Error('Likely CORS error. Cloud mode may help.')
  }
  return new Error('This URL is not an OpenAPI document or an MCP server.')
}
