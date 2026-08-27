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
  specRequestSchema,
} from './schemas'
import { executeUpstreamRequest, fetchUpstreamSpec } from './upstream'

export type CreateApiOptions = {
  fetch?: typeof fetch
  openapi?: {
    title?: string
    version?: string
    servers?: Array<{ url: string; description?: string }>
  }
}

const specDocumentSchema = z.any().openapi('SpecDocument')

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
  summary: 'Execute an HTTP request against an upstream API',
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
    summary: 'Proxy a Streamable HTTP MCP request',
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

  const routes = app
    .openapi(specRoute, async (c) => {
      try {
        const document = await fetchUpstreamSpec(c.req.valid('json').url, upstreamFetch)
        return c.json(document, 200)
      } catch (error) {
        return c.json({ error: errorMessage(error, 'Could not fetch the spec.') }, 400)
      }
    })
    .openapi(executeRoute, async (c) => {
      try {
        const data = c.req.valid('json')
        const result = await executeUpstreamRequest(
          {
            ...data,
            headers: data.headers ?? {},
          },
          upstreamFetch,
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

  routes.on(['PUT', 'PATCH', 'OPTIONS', 'HEAD'], '/mcp-proxy', (c) =>
    proxyMcpRequest(c.req.raw, upstreamFetch),
  )

  routes.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: options.openapi?.title ?? 'Hookfish API',
      version: options.openapi?.version ?? '1.0.0',
    },
    servers: options.openapi?.servers ?? [{ url: '/' }],
  })

  return routes
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
