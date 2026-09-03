import { z } from '@hono/zod-openapi'

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

export const okSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi('Ok')

export type ExecuteRequest = z.infer<typeof executeRequestSchema>
export type ExecuteResult = z.infer<typeof executeResultSchema>
export type SignUpRequest = z.infer<typeof signUpRequestSchema>
export type SignInRequest = z.infer<typeof signInRequestSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
