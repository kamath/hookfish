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

const registryObjectSchema = z.record(z.string(), z.any())

export const registryEntryKindSchema = z.enum(['openapi', 'mcp'])

export const registryEntryMetadataSchema = z
  .object({
    kind: registryEntryKindSchema,
    title: z.string(),
    version: z.string().optional(),
    description: z.string().optional(),
    executables: z.array(registryObjectSchema),
    groups: z.array(registryObjectSchema),
    labels: registryObjectSchema,
    adapterData: z.any().optional(),
    credentialSchema: registryObjectSchema.optional(),
    credentialUiSchema: registryObjectSchema.optional(),
    credentialsRequired: z.boolean().optional(),
  })
  .openapi('RegistryEntryMetadata')

export const registrySubmissionSchema = z
  .object({
    cache: z.boolean().default(true),
    force: z.boolean().optional(),
    sourceUrl: z.string().trim().min(1),
    metadata: registryEntryMetadataSchema,
  })
  .openapi('RegistrySubmission')

export const registryEntryParamsSchema = z.object({
  sourceId: z.string().trim().min(1),
})

export const registryQuerySchema = z.object({
  kind: registryEntryKindSchema.optional(),
})

export const registryLookupQuerySchema = z.object({
  kind: registryEntryKindSchema.optional(),
  sourceUrl: z.string().trim().min(1).optional(),
})

export const registryEntrySchema = z
  .object({
    sourceId: z.string(),
    sourceUrl: z.string(),
    createdByUserId: z.string().nullable(),
    metadata: registryEntryMetadataSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('RegistryEntry')

export const registryEntrySummarySchema = z
  .object({
    sourceId: z.string(),
    sourceUrl: z.string(),
    createdByUserId: z.string().nullable(),
    kind: registryEntryKindSchema,
    title: z.string(),
    version: z.string().optional(),
    executableCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('RegistryEntrySummary')

export const registryEntryResponseSchema = z
  .object({
    entry: registryEntrySchema,
  })
  .openapi('RegistryEntryResponse')

export const registrySubmissionResponseSchema = z
  .object({
    cached: z.boolean(),
    entry: registryEntrySummarySchema.nullable(),
    reason: z
      .enum([
        'cache-disabled',
        'invalid-url',
        'non-https-url',
        'non-public-url',
        'credential-bearing-url',
      ])
      .optional(),
  })
  .openapi('RegistrySubmissionResponse')

export const registryListSchema = z
  .object({
    entries: z.array(registryEntrySummarySchema),
  })
  .openapi('RegistryList')

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
export type RegistryEntryMetadata = z.infer<typeof registryEntryMetadataSchema>
export type SignUpRequest = z.infer<typeof signUpRequestSchema>
export type SignInRequest = z.infer<typeof signInRequestSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>
export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>
