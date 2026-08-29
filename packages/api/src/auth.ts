import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import {
  resolveDatabase,
  type AppDatabase,
  type DatabaseInput,
} from './db/types'
import { isCloudflareProduction, type RuntimeEnv } from './db/url'
import { schema } from './db/schema'

function authSecret(env: RuntimeEnv) {
  if (env.BETTER_AUTH_SECRET) {
    return env.BETTER_AUTH_SECRET
  }
  if (isCloudflareProduction()) {
    throw new Error('BETTER_AUTH_SECRET is required on Cloudflare.')
  }
  return 'hookfish-dev-secret-change-me'
}

async function createAuth(
  db: AppDatabase,
  env: RuntimeEnv,
  baseURL: string,
  basePath: string,
) {
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

const authCache = new WeakMap<
  AppDatabase,
  Map<string, ReturnType<typeof createAuth>>
>()

export async function getAuth(
  database: DatabaseInput,
  env: RuntimeEnv,
  baseURL: string,
  basePath: string,
) {
  const db = await resolveDatabase(database)
  const key = `${baseURL}|${basePath}`
  let databaseCache = authCache.get(db)
  if (!databaseCache) {
    databaseCache = new Map()
    authCache.set(db, databaseCache)
  }
  const cached = databaseCache.get(key)
  if (cached) {
    return cached
  }

  const created = createAuth(db, env, baseURL, basePath)
  databaseCache.set(key, created)
  return created
}

export async function handleAuthRequest(
  request: Request,
  database: DatabaseInput,
  env: RuntimeEnv,
  authBasePath: string,
) {
  const baseURL = env.BETTER_AUTH_URL ?? new URL(request.url).origin
  const auth = await getAuth(database, env, baseURL, authBasePath)
  return auth.handler(request)
}

export type Auth = Awaited<ReturnType<typeof getAuth>>
