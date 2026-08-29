import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { resolveApiKeyUser } from './api-keys'
import { getAuthForRequest, type AuthOptions } from './auth'
import { user } from './db/schema'
import { resolveDatabase } from './db/types'
import type { AuthUser } from './schemas'

export type AuthenticationMethod = 'api-key' | 'jwt' | 'session'

export type ApiVariables = {
  authUser: AuthUser | null
  authMethod: AuthenticationMethod | null
}

type Authentication = {
  user: AuthUser
  method: AuthenticationMethod
}

function asUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || typeof candidate.email !== 'string') {
    return null
  }
  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' ? candidate.name : '',
    email: candidate.email,
    image: typeof candidate.image === 'string' ? candidate.image : null,
    emailVerified: candidate.emailVerified === true,
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization) {
    return null
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() || ''
}

async function userById(options: AuthOptions, userId: string) {
  if (!options.database) {
    return null
  }
  const db = await resolveDatabase(options.database)
  const [record] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return record ?? null
}

async function authenticateJwt(request: Request, token: string, options: AuthOptions) {
  try {
    const auth = await getAuthForRequest(request, options)
    const result = await auth.api.verifyJWT({ body: { token } })
    return typeof result.payload?.sub === 'string'
      ? userById(options, result.payload.sub)
      : null
  } catch {
    return null
  }
}

async function authenticateSession(request: Request, options: AuthOptions) {
  try {
    const auth = await getAuthForRequest(request, options)
    const result = await auth.api.getSession({ headers: request.headers })
    return asUser(result?.user)
  } catch {
    return null
  }
}

export async function authenticateRequest(
  request: Request,
  options: AuthOptions,
): Promise<Authentication | null> {
  const headerApiKey = request.headers.get('x-api-key')?.trim()
  const bearer = bearerToken(request)
  const explicitCredential = headerApiKey ?? bearer

  if (explicitCredential !== null && explicitCredential !== undefined) {
    if (!explicitCredential || !options.database) {
      return null
    }

    const method: AuthenticationMethod =
      headerApiKey === undefined && explicitCredential.split('.').length === 3
        ? 'jwt'
        : 'api-key'
    const authenticatedUser =
      method === 'jwt'
        ? await authenticateJwt(request, explicitCredential, options)
        : await resolveApiKeyUser(options.database, explicitCredential)

    return authenticatedUser ? { user: authenticatedUser, method } : null
  }

  if (!options.database || !request.headers.has('cookie')) {
    return null
  }
  const sessionUser = await authenticateSession(request, options)
  return sessionUser ? { user: sessionUser, method: 'session' } : null
}

export function authenticationMiddleware(
  options: AuthOptions,
): MiddlewareHandler<{ Variables: ApiVariables }> {
  return async (c, next) => {
    const hasExplicitCredential =
      c.req.header('x-api-key') !== undefined || c.req.header('authorization') !== undefined
    const authentication = await authenticateRequest(c.req.raw, options)

    if (hasExplicitCredential && !authentication) {
      return c.json({ error: 'Invalid or expired authentication credential.' }, 401)
    }

    c.set('authUser', authentication?.user ?? null)
    c.set('authMethod', authentication?.method ?? null)
    await next()
  }
}
