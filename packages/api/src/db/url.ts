import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type HyperdriveBinding = {
  connectionString: string
}

export type RuntimeEnv = {
  HYPERDRIVE?: HyperdriveBinding
  POSTGRES_URL?: string
  PGLITE_DATA_DIR?: string
  DRIZZLE_PROD?: string
  npm_lifecycle_event?: string
}

export type PostgresTarget = {
  kind: 'postgres'
  url: string
}

export type PgliteTarget = {
  kind: 'pglite'
  dataDir: string
}

export type DatabaseTarget = PostgresTarget | PgliteTarget

export function isPostgresUrl(value: string | undefined): value is string {
  return Boolean(value && /^(postgres|postgresql):\/\//i.test(value.trim()))
}

export function isDrizzleProd(env: RuntimeEnv = process.env): boolean {
  return env.DRIZZLE_PROD === '1' || (env.npm_lifecycle_event ?? '').endsWith(':prod')
}

export function isCloudflareWorker(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
}

export function isViteDevRuntime(): boolean {
  return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)
}

export function isCloudflareProduction(
  options: { cloudflare?: boolean; localDev?: boolean } = {},
): boolean {
  if (options.localDev ?? isViteDevRuntime()) {
    return false
  }

  return options.cloudflare ?? isCloudflareWorker()
}

export function resolvePgliteDataDir(env: RuntimeEnv = {}, moduleUrl = import.meta.url) {
  if (env.PGLITE_DATA_DIR) {
    return env.PGLITE_DATA_DIR
  }

  const packageIndex = moduleUrl.indexOf('/packages/api/')
  if (packageIndex !== -1) {
    return fileURLToPath(`${moduleUrl.slice(0, packageIndex)}/packages/api/.data`)
  }

  return join(homedir(), '.hookfish', 'pglite')
}

export function resolveDatabaseTarget(
  env: RuntimeEnv = {},
  options: { moduleUrl?: string; cloudflare?: boolean; localDev?: boolean } = {},
): DatabaseTarget {
  const hyperdrive = env.HYPERDRIVE?.connectionString
  if (hyperdrive) {
    return { kind: 'postgres', url: hyperdrive }
  }

  if (isPostgresUrl(env.POSTGRES_URL)) {
    return { kind: 'postgres', url: env.POSTGRES_URL.trim() }
  }

  if (isDrizzleProd(env)) {
    throw new Error('POSTGRES_URL is required for production database commands.')
  }

  if (isCloudflareProduction(options)) {
    throw new Error('Cloudflare requires a Hyperdrive binding or POSTGRES_URL.')
  }

  return {
    kind: 'pglite',
    dataDir: resolvePgliteDataDir(env, options.moduleUrl),
  }
}
