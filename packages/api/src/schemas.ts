import { z } from '@hono/zod-openapi'
import { apiKeyExpirations } from './api-keys'

export const errorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('Error')

export const specRequestSchema = z
  .object({
    url: z.string().trim().min(1),
  })
  .openapi('SpecRequest')

export const executeRequestSchema = z
  .object({
    transport: z.literal('http'),
    method: z.string().trim().min(1),
    url: z.string().trim().min(1),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
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

const cachedObjectSchema = z.record(z.string(), z.any())

export const cachedSourceKindSchema = z.enum(['openapi', 'mcp'])

export const cachedSourceMetadataSchema = z
  .object({
    kind: cachedSourceKindSchema,
    title: z.string(),
    version: z.string().optional(),
    description: z.string().optional(),
    executables: z.array(cachedObjectSchema),
    groups: z.array(cachedObjectSchema),
    labels: cachedObjectSchema,
    adapterData: z.any().optional(),
  })
  .openapi('CachedSourceMetadata')

export const cacheSourceRequestSchema = z
  .object({
    cache: z.boolean().default(true),
    metadata: cachedSourceMetadataSchema,
  })
  .openapi('CacheSourceRequest')

export const cachedSourceParamsSchema = z.object({
  sourceId: z.string().trim().min(1),
})

export const cachedSourceQuerySchema = z.object({
  kind: cachedSourceKindSchema.optional(),
})

export const cachedSourceSchema = z
  .object({
    sourceId: z.string(),
    createdByUserId: z.string().nullable(),
    metadata: cachedSourceMetadataSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('CachedSource')

export const cachedSourceSummarySchema = z
  .object({
    sourceId: z.string(),
    createdByUserId: z.string().nullable(),
    kind: cachedSourceKindSchema,
    title: z.string(),
    version: z.string().optional(),
    executableCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('CachedSourceSummary')

export const cachedSourceResponseSchema = z
  .object({
    cachedSource: cachedSourceSchema,
  })
  .openapi('CachedSourceResponse')

export const cacheSourceResponseSchema = z
  .object({
    cached: z.boolean(),
    cachedSource: cachedSourceSummarySchema.nullable(),
  })
  .openapi('CacheSourceResponse')

export const cachedSourceListSchema = z
  .object({
    cachedSources: z.array(cachedSourceSummarySchema),
  })
  .openapi('CachedSourceList')

export const signUpRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    password: z.string().min(8),
  })
  .openapi('SignUpRequest')

export const signInRequestSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  })
  .openapi('SignInRequest')

export const authUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
    emailVerified: z.boolean().optional(),
  })
  .openapi('AuthUser')

export const authSessionSchema = z
  .object({
    user: authUserSchema.nullable(),
  })
  .openapi('AuthSession')

export const apiKeyExpirationSchema = z.enum(apiKeyExpirations).openapi('ApiKeyExpiration')

export const createApiKeyRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    expiration: apiKeyExpirationSchema,
  })
  .openapi('CreateApiKeyRequest')

export const apiKeySummarySchema = z
  .object({
    name: z.string(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .openapi('ApiKeySummary')

export const createdApiKeySchema = apiKeySummarySchema
  .extend({
    key: z.string(),
  })
  .openapi('CreatedApiKey')

export const createApiKeyResponseSchema = z
  .object({
    apiKey: createdApiKeySchema,
  })
  .openapi('CreateApiKeyResponse')

export const apiKeyListSchema = z
  .object({
    apiKeys: z.array(apiKeySummarySchema),
  })
  .openapi('ApiKeyList')

export const okSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi('Ok')

export type ExecuteRequest = z.infer<typeof executeRequestSchema>
export type ExecuteResult = z.infer<typeof executeResultSchema>
export type CachedSourceMetadata = z.infer<typeof cachedSourceMetadataSchema>
export type SignUpRequest = z.infer<typeof signUpRequestSchema>
export type SignInRequest = z.infer<typeof signInRequestSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>
export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>
