import { z } from '@hono/zod-openapi'

export const errorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('Error')

export const specRequestSchema = z
  .object({
    url: z.string().trim().min(1),
    save: z.boolean().optional(),
    title: z.string().trim().min(1).optional(),
    type: z.enum(['MCP', 'API']).optional(),
  })
  .openapi('SpecRequest')

export const httpRequestSchema = z
  .object({
    transport: z.literal('http'),
    method: z.string().trim().min(1),
    url: z.string().trim().min(1),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
  })
  .openapi('HttpRequest')

export const executeRequestSchema = httpRequestSchema
  .extend({
    specUrl: z.string().trim().min(1),
  })
  .openapi('ExecuteRequest')

export const executeResultSchema = z
  .object({
    status: z.object({
      code: z.number(),
      text: z.string(),
    }),
    details: z.object({
      label: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      ),
    }),
    body: z.string(),
    elapsedMs: z.number(),
    target: z.string(),
    action: z.string(),
  })
  .openapi('ExecuteResult')

export const mcpOAuthClientQuerySchema = z.object({
  sourceId: z.string().min(1),
})

export const mcpOAuthClientSchema = z
  .object({
    client_id: z.string(),
    client_name: z.string(),
    client_uri: z.string(),
    redirect_uris: z.array(z.string()),
    response_types: z.array(z.string()),
    grant_types: z.array(z.string()),
    token_endpoint_auth_method: z.string(),
  })
  .openapi('McpOAuthClient')

export const mcpProxyQuerySchema = z.object({
  url: z.string().optional(),
})

export const registryFeedItemSchema = z
  .object({
    url: z.string(),
    title: z.string(),
    type: z.enum(['MCP', 'API']),
  })
  .openapi('RegistryFeedItem')

export const registryFeedSchema = z
  .record(z.string(), z.array(registryFeedItemSchema))
  .openapi('RegistryFeed')

export const registryEntryQuerySchema = z.object({
  url: z.string().trim().min(1),
})

export const registryEntrySchema = z
  .object({
    registered: z.boolean(),
    url: z.string().optional(),
    title: z.string().optional(),
    type: z.enum(['MCP', 'API']).optional(),
  })
  .openapi('RegistryEntry')

export type HttpRequest = z.infer<typeof httpRequestSchema>
export type ExecuteRequest = z.infer<typeof executeRequestSchema>
export type ExecuteResult = z.infer<typeof executeResultSchema>
export type RegistryFeed = z.infer<typeof registryFeedSchema>
export type RegistryEntryStatus = z.infer<typeof registryEntrySchema>
