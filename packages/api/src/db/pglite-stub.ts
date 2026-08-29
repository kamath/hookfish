export function findDrizzleMigrationsDir(): never {
  throw new Error('PGlite is not available on Cloudflare. Bind Hyperdrive or set POSTGRES_URL.')
}

export async function createPgliteDb(_dataDir: string): Promise<never> {
  throw new Error('PGlite is not available on Cloudflare. Bind Hyperdrive or set POSTGRES_URL.')
}
