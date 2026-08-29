import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { getDb } from './db'
import { isCloudflareWorker, type RuntimeEnv } from './db/url'
import { schema } from './db/schema'

function authSecret(env: RuntimeEnv) {
  if (env.BETTER_AUTH_SECRET) {
    return env.BETTER_AUTH_SECRET
  }
  if (isCloudflareWorker()) {
    throw new Error('BETTER_AUTH_SECRET is required on Cloudflare.')
  }
  return 'hookfish-dev-secret-change-me'
}

async function createAuth(env: RuntimeEnv, baseURL: string, basePath: string) {
  const db = await getDb(env)
  return betterAuth({
    baseURL,
    basePath,
    secret: authSecret(env),
    trustedOrigins: [new URL(baseURL).origin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
  })
}

const authCache = new Map<string, ReturnType<typeof createAuth>>()

export async function getAuth(env: RuntimeEnv, baseURL: string, basePath: string) {
  const key = `${baseURL}|${basePath}|${env.POSTGRES_URL ?? ''}|${env.PGLITE_DATA_DIR ?? ''}|${env.HYPERDRIVE?.connectionString ?? ''}`
  const cached = authCache.get(key)
  if (cached) {
    return cached
  }

  const created = createAuth(env, baseURL, basePath)
  authCache.set(key, created)
  return created
}

export async function handleAuthRequest(
  request: Request,
  env: RuntimeEnv,
  authBasePath: string,
) {
  const baseURL = env.BETTER_AUTH_URL ?? new URL(request.url).origin
  const auth = await getAuth(env, baseURL, authBasePath)
  return auth.handler(request)
}

export type Auth = Awaited<ReturnType<typeof getAuth>>
