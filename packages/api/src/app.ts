import { Hono } from 'hono'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { mcpOAuthClientMetadata } from './oauth'
import { proxyMcpRequest } from './proxy'
import {
  errorSchema,
  executeRequestSchema,
  executeResultSchema,
  mcpOAuthClientQuerySchema,
  mcpOAuthClientSchema,
  mcpProxyQuerySchema,
  registryFeedSchema,
  specRequestSchema,
} from './schemas'
import { resolveDatabase, type DatabaseInput } from './db/types'
import {
  INTERNAL_FETCH_HEADER,
  isOwnOpenApiUrl,
  ownApiRequest,
  withInternalFetchHeader,
} from './self'
import { assertHttpRequestMatchesSpec } from './spec'
import { executeUpstreamRequest, fetchUpstreamSpec } from './upstream'

export type CreateApiOptions = {
  fetch?: typeof fetch
  database?: DatabaseInput
  openapi?: {
    title?: string
    version?: string
    servers?: Array<{ url: string; description?: string }>
  }
}

const specDocumentSchema = z.any().openapi('SpecDocument')
const registryFeedCategories: ReadonlyArray<{
  tag: string
  categoryName: string
}> = [
  { tag: 'trending_mcp', categoryName: 'MCP Servers' },
  { tag: 'trending_api', categoryName: 'APIs' },
]

const registryFeedRoute = createRoute({
  method: 'get',
  path: '/registry/feed',
  tags: ['Registry'],
  summary: 'List suggested sources grouped by category',
  responses: {
    200: {
      description: 'Suggested sources grouped by category name',
      content: {
        'application/json': {
          schema: registryFeedSchema,
        },
      },
    },
    503: {
      description: 'The registry feed database is not configured',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

const specRoute = createRoute({
  method: 'post',
  path: '/spec',
  tags: ['OpenAPI'],
  summary: 'Fetch and parse an OpenAPI document',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: specRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Parsed OpenAPI document',
      content: {
        'application/json': {
          schema: specDocumentSchema,
        },
      },
    },
    400: {
      description: 'The spec could not be fetched or parsed',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

const executeRoute = createRoute({
  method: 'post',
  path: '/execute',
  tags: ['OpenAPI'],
  summary: 'Execute an HTTP request that matches an operation in an OpenAPI document',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: executeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Upstream response',
      content: {
        'application/json': {
          schema: executeResultSchema,
        },
      },
    },
    400: {
      description: 'The request could not be executed',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

const oauthRoute = createRoute({
  method: 'get',
  path: '/mcp-oauth-client',
  tags: ['MCP'],
  summary: 'OAuth client metadata document for an MCP source',
  request: {
    query: mcpOAuthClientQuerySchema,
  },
  responses: {
    200: {
      description: 'OAuth client metadata',
      content: {
        'application/json': {
          schema: mcpOAuthClientSchema,
        },
      },
    },
    400: {
      description: 'A sourceId is required',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

function mcpProxyRoute(method: 'get' | 'post' | 'delete') {
  return createRoute({
    method,
    path: '/mcp-proxy',
    tags: ['MCP'],
    summary: 'Proxy a Streamable HTTP MCP or MCP OAuth request',
    request: {
      query: mcpProxyQuerySchema,
    },
    responses: {
      200: {
        description: 'Proxied MCP response',
      },
      400: {
        description: 'The MCP endpoint URL is invalid',
        content: {
          'application/json': {
            schema: errorSchema,
          },
        },
      },
    },
  })
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function createApi(options: CreateApiOptions = {}) {
  const upstreamFetch = options.fetch ?? fetch
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0]
        return c.json({ error: issue?.message ?? 'Invalid request.' }, 400)
      }
    },
  })

  const openApiConfig = {
    openapi: '3.1.0' as const,
    info: {
      title: options.openapi?.title ?? 'Smithery API',
      version: options.openapi?.version ?? '1.0.0',
    },
    servers: options.openapi?.servers ?? [{ url: '/' }],
  }

  const fetchOwnOrUpstream: (requestUrl: string, nested: boolean) => typeof fetch =
    (requestUrl, nested) =>
      async (input, init) => {
        const own = ownApiRequest(input, init, requestUrl)
        if (!own) {
          return upstreamFetch(input, init)
        }
        if (nested && new URL(own.url).pathname === '/execute') {
          throw new Error("Cannot proxy this API's execute endpoint through itself.")
        }
        return app.fetch(withInternalFetchHeader(own))
      }

  const routes = app
    .openapi(registryFeedRoute, async (c) => {
      if (!options.database) {
        return c.json({ error: 'The registry feed database is not configured.' }, 503)
      }
      const database = await resolveDatabase(options.database)
      const feed: Record<string, Array<{ url: string; title: string; type: 'MCP' | 'API' }>> =
        Object.fromEntries(
          registryFeedCategories.map(({ categoryName }) => [categoryName, []]),
        )
      const categoryNames = new Map(
        registryFeedCategories.map(({ tag, categoryName }) => [tag, categoryName]),
      )
      const rows = await database.listRegistryFeedRows(
        registryFeedCategories.map(({ tag }) => tag),
      )
      for (const row of rows) {
        const categoryName = categoryNames.get(row.tag)
        if (!categoryName) {
          continue
        }
        const category = feed[categoryName] ?? []
        category.push({
          url: row.url,
          title: row.title,
          type: row.type,
        })
        feed[categoryName] = category
      }
      return c.json(feed, 200)
    })
    .openapi(specRoute, async (c) => {
      try {
        const specUrl = c.req.valid('json').url
        if (isOwnOpenApiUrl(specUrl, c.req.url)) {
          return c.json(app.getOpenAPI31Document(openApiConfig), 200)
        }
        const document = await fetchUpstreamSpec(specUrl, fetchOwnOrUpstream(c.req.url, true))
        return c.json(document, 200)
      } catch (error) {
        return c.json({ error: errorMessage(error, 'Could not fetch the spec.') }, 400)
      }
    })
    .openapi(executeRoute, async (c) => {
      try {
        const data = c.req.valid('json')
        const nested = c.req.header(INTERNAL_FETCH_HEADER) === '1'
        const fetchImpl = fetchOwnOrUpstream(c.req.url, nested)
        const document = isOwnOpenApiUrl(data.specUrl, c.req.url)
          ? app.getOpenAPI31Document(openApiConfig)
          : await fetchUpstreamSpec(data.specUrl, fetchImpl)
        assertHttpRequestMatchesSpec(document, data.specUrl, data, c.req.url)
        const result = await executeUpstreamRequest(
          {
            transport: data.transport,
            method: data.method,
            url: data.url,
            headers: data.headers ?? {},
            body: data.body,
          },
          fetchImpl,
        )
        return c.json(result, 200)
      } catch (error) {
        return c.json({ error: errorMessage(error, 'The request could not be executed.') }, 400)
      }
    })
    .openapi(oauthRoute, (c) => {
      const url = new URL(c.req.url)
      const sourceId = c.req.valid('query').sourceId
      return c.json(
        {
          client_id: url.toString(),
          ...mcpOAuthClientMetadata(sourceId, url.origin),
        },
        200,
        {
          'Cache-Control': 'public, max-age=300',
        },
      )
    })
    .openapi(mcpProxyRoute('get'), (c) => proxyMcpRequest(c.req.raw, upstreamFetch))
    .openapi(mcpProxyRoute('post'), (c) => proxyMcpRequest(c.req.raw, upstreamFetch))
    .openapi(mcpProxyRoute('delete'), (c) => proxyMcpRequest(c.req.raw, upstreamFetch))

  return routes.doc31('/openapi.json', openApiConfig)
}

export type AppType = ReturnType<typeof createApi>

export function mountApi(basePath = '/api', options: CreateApiOptions = {}) {
  return new Hono().route(
    basePath,
    createApi({
      ...options,
      openapi: {
        ...options.openapi,
        servers: options.openapi?.servers ?? [{ url: basePath }],
      },
    }),
  )
}
