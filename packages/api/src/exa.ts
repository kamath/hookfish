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
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
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
