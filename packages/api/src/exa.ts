import { isAllowedCustomHeader } from './headers'
import { isHttpUrl } from './http'
import type { RegistrySearchResult } from './schemas'

export const EXA_SEARCH_URL = 'https://api.exa.ai/search'

const MAX_RESULTS = 5

// Exa synthesizes `output.content` against this schema from the pages it finds.
const outputSchema = {
  type: 'object',
  properties: {
    servers: {
      type: 'array',
      description: 'Remote MCP servers that match the query, best match first.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the MCP server.' },
          mcpUrl: {
            type: 'string',
            description: 'Remote MCP endpoint URL (Streamable HTTP or SSE).',
          },
          homepage: { type: 'string', description: 'Documentation page for the server.' },
          description: { type: 'string', description: 'One sentence on what it does.' },
          authType: {
            type: 'string',
            enum: ['none', 'oauth', 'headers'],
            description:
              'How clients authenticate to this endpoint. oauth if it supports an OAuth sign-in flow, even when it also accepts API keys. headers if it only accepts an API key or token sent in a request header. none if it needs no credentials.',
          },
          requiredHeaders: {
            type: 'array',
            items: { type: 'string' },
            description:
              'HTTP header names the client must send, such as Authorization or X-API-Key. One header per credential: when the docs accept several names for the same key, give only the recommended one. Leave out optional headers. Empty unless authType is headers.',
          },
        },
        required: ['name', 'mcpUrl'],
      },
    },
  },
  required: ['servers'],
}

type ExaServer = {
  name?: unknown
  mcpUrl?: unknown
  homepage?: unknown
  description?: unknown
  authType?: unknown
  requiredHeaders?: unknown
}

type SearchAuth = RegistrySearchResult['auth']

const CREDENTIAL_HEADER = /auth|key|token/i

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function requiredHeaders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const names = new Map<string, string>()
  for (const item of value) {
    const name = optionalString(item)
    if (name && isAllowedCustomHeader(name) && !names.has(name.toLowerCase())) {
      names.set(name.toLowerCase(), name)
    }
  }
  // Credential headers listed together are almost always alternatives for one secret (docs
  // offering Authorization or X-API-Key), so keep one, preferring Authorization.
  const all = [...names.values()]
  const credentials = all.filter((name) => CREDENTIAL_HEADER.test(name))
  const credential =
    credentials.find((name) => name.toLowerCase() === 'authorization') ?? credentials[0]
  return all.filter((name) => !CREDENTIAL_HEADER.test(name) || name === credential)
}

function searchAuth(server: ExaServer): { auth: SearchAuth; headers: string[] } {
  // OAuth needs nothing up front, so it wins over any headers listed alongside it.
  if (server.authType === 'none' || server.authType === 'oauth') {
    return { auth: server.authType, headers: [] }
  }
  const headers = requiredHeaders(server.requiredHeaders)
  if (headers.length > 0) {
    return { auth: 'headers', headers }
  }
  if (server.authType === 'headers') {
    // A token server that didn't name its header almost always wants Authorization.
    return { auth: 'headers', headers: ['Authorization'] }
  }
  return { auth: 'unknown', headers: [] }
}

/** Pull MCP servers out of an Exa structured-output response, dropping unusable ones. */
export function exaSearchResults(body: unknown): RegistrySearchResult[] {
  const content = (body as { output?: { content?: unknown } } | undefined)?.output?.content
  const servers = (content as { servers?: unknown } | undefined)?.servers
  if (!Array.isArray(servers)) {
    return []
  }
  const seen = new Set<string>()
  const results: RegistrySearchResult[] = []
  for (const server of servers as ExaServer[]) {
    const url = optionalString(server?.mcpUrl)
    const title = optionalString(server?.name)
    if (!url || !title || !isHttpUrl(url) || seen.has(url)) {
      continue
    }
    seen.add(url)
    const homepage = optionalString(server.homepage)
    results.push({
      url,
      title,
      type: 'MCP',
      homepage: homepage && isHttpUrl(homepage) ? homepage : undefined,
      description: optionalString(server.description),
      ...searchAuth(server),
    })
  }
  return results.slice(0, MAX_RESULTS)
}

/** Ask Exa for remote MCP servers matching `query`, as structured output. */
export async function searchMcpServers(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RegistrySearchResult[]> {
  const response = await fetchImpl(EXA_SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query: `remote MCP server URL for ${query}`,
      type: 'auto',
      numResults: MAX_RESULTS,
      outputSchema,
    }),
  })
  if (!response.ok) {
    throw new Error(`Web search failed (${response.status}).`)
  }
  return exaSearchResults(await response.json())
}
