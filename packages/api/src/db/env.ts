/// <reference path="../cloudflare-env.d.ts" />
import type { RuntimeEnv } from './url'

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function fromProcess(): RuntimeEnv {
  return {
    POSTGRES_URL: process.env.POSTGRES_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
    DRIZZLE_PROD: process.env.DRIZZLE_PROD,
    npm_lifecycle_event: process.env.npm_lifecycle_event,
  }
}

function fromUnknown(env: Record<string, unknown>): RuntimeEnv {
  const hyperdrive = env.HYPERDRIVE
  return {
    HYPERDRIVE:
      hyperdrive &&
      typeof hyperdrive === 'object' &&
      'connectionString' in hyperdrive &&
      typeof hyperdrive.connectionString === 'string'
        ? { connectionString: hyperdrive.connectionString }
        : undefined,
    POSTGRES_URL: asString(env.POSTGRES_URL),
    BETTER_AUTH_SECRET: asString(env.BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: asString(env.BETTER_AUTH_URL),
    PGLITE_DATA_DIR: asString(env.PGLITE_DATA_DIR),
    DRIZZLE_PROD: asString(env.DRIZZLE_PROD),
    npm_lifecycle_event: asString(env.npm_lifecycle_event),
  }
}

export async function readCloudflareEnv(): Promise<RuntimeEnv> {
  try {
    const mod = (await import('cloudflare:workers')) as { env?: Record<string, unknown> }
    return fromUnknown((mod.env ?? {}) as Record<string, unknown>)
  } catch {
    return {}
  }
}

export async function resolveRuntimeEnv(override?: RuntimeEnv): Promise<RuntimeEnv> {
  const cloudflare = await readCloudflareEnv()
  return {
    ...fromProcess(),
    ...cloudflare,
    ...override,
  }
}
