import type { Context } from 'hono'
import { createRoute } from '@hono/zod-openapi'
import { getAuthForRequest, type AuthOptions } from './auth'
import {
  apiKeyListSchema,
  authSessionSchema,
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
  errorSchema,
  okSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from './schemas'

export type AuthRouteOptions = AuthOptions

export const signUpRoute = createRoute({
  method: 'post',
  path: '/auth/sign-up',
  tags: ['Auth'],
  summary: 'Create an email and password account',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: signUpRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Signed-in user',
      content: {
        'application/json': {
          schema: authSessionSchema,
        },
      },
    },
    400: {
      description: 'The account could not be created',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

export const signInRoute = createRoute({
  method: 'post',
  path: '/auth/sign-in',
  tags: ['Auth'],
  summary: 'Sign in with email and password',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: signInRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Signed-in user',
      content: {
        'application/json': {
          schema: authSessionSchema,
        },
      },
    },
    400: {
      description: 'The credentials were rejected',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

export const signOutRoute = createRoute({
  method: 'post',
  path: '/auth/sign-out',
  tags: ['Auth'],
  summary: 'Sign out of the current session',
  responses: {
    200: {
      description: 'Signed out',
      content: {
        'application/json': {
          schema: okSchema,
        },
      },
    },
  },
})

export const sessionRoute = createRoute({
  method: 'get',
  path: '/auth/session',
  tags: ['Auth'],
  summary: 'Read the current session',
  responses: {
    200: {
      description: 'Current user, or null when signed out',
      content: {
        'application/json': {
          schema: authSessionSchema,
        },
      },
    },
  },
})

export const createApiKeyRoute = createRoute({
  method: 'post',
  path: '/auth/api-keys',
  tags: ['Auth'],
  summary: 'Create an API key',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createApiKeyRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'API key secret, returned only at creation time',
      content: {
        'application/json': {
          schema: createApiKeyResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication is required',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

export const listApiKeysRoute = createRoute({
  method: 'get',
  path: '/auth/api-keys',
  tags: ['Auth'],
  summary: 'List API key names and expirations',
  responses: {
    200: {
      description: 'API key metadata without secrets',
      content: {
        'application/json': {
          schema: apiKeyListSchema,
        },
      },
    },
    401: {
      description: 'Authentication is required',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
})

function applySetCookies(c: Context, response: Response) {
  for (const cookie of response.headers.getSetCookie()) {
    c.header('Set-Cookie', cookie, { append: true })
  }
}

function errorFromBody(body: unknown, fallback: string) {
  if (body && typeof body === 'object') {
    if ('message' in body && typeof body.message === 'string' && body.message) {
      return body.message
    }
    if ('error' in body && typeof body.error === 'string' && body.error) {
      return body.error
    }
  }
  return fallback
}

function asUser(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const user = value as {
    id?: unknown
    name?: unknown
    email?: unknown
    image?: unknown
    emailVerified?: unknown
  }
  if (typeof user.id !== 'string' || typeof user.email !== 'string') {
    return null
  }
  return {
    id: user.id,
    name: typeof user.name === 'string' ? user.name : '',
    email: user.email,
    image: typeof user.image === 'string' ? user.image : null,
    emailVerified: user.emailVerified === true,
  }
}

async function authForRequest(c: Context, options: AuthRouteOptions) {
  return getAuthForRequest(c.req.raw, options)
}

function userFromPayload(payload: unknown) {
  return (
    asUser(payload) ??
    asUser(payload && typeof payload === 'object' && 'user' in payload ? payload.user : null)
  )
}

export async function handleSignUp(
  c: Context,
  body: { name: string; email: string; password: string },
  options: AuthRouteOptions,
) {
  const auth = await authForRequest(c, options)
  const response = await auth.api.signUpEmail({
    body,
    asResponse: true,
    headers: c.req.raw.headers,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false as const, error: errorFromBody(payload, 'Could not create the account.'), cookies: response }
  }
  return { ok: true as const, user: userFromPayload(payload), cookies: response }
}

export async function handleSignIn(
  c: Context,
  body: { email: string; password: string },
  options: AuthRouteOptions,
) {
  const auth = await authForRequest(c, options)
  const response = await auth.api.signInEmail({
    body,
    asResponse: true,
    headers: c.req.raw.headers,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false as const, error: errorFromBody(payload, 'Could not sign in.'), cookies: response }
  }
  return { ok: true as const, user: userFromPayload(payload), cookies: response }
}

export async function handleSignOut(c: Context, options: AuthRouteOptions) {
  const auth = await authForRequest(c, options)
  const response = await auth.api.signOut({
    asResponse: true,
    headers: c.req.raw.headers,
  })
  return response
}

export async function handleSession(c: Context, options: AuthRouteOptions) {
  const auth = await authForRequest(c, options)
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  })

  const wrapped =
    result && typeof result === 'object' && 'headers' in result
      ? (result as { headers: Headers; response?: unknown })
      : null
  const payload = wrapped && 'response' in wrapped ? wrapped.response : result
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const user =
    userFromPayload(record) ??
    userFromPayload(record?.user) ??
    userFromPayload(
      record?.session && typeof record.session === 'object'
        ? (record.session as { user?: unknown }).user
        : null,
    )

  return {
    user,
    cookies: wrapped?.headers ? new Response(null, { headers: wrapped.headers }) : undefined,
  }
}

export { applySetCookies }

export async function handleNativeAuth(c: Context, options: AuthRouteOptions) {
  const auth = await authForRequest(c, options)
  return auth.handler(c.req.raw)
}
