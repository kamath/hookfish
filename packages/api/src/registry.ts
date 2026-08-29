import { eq } from 'drizzle-orm'
import { registryEntry } from './db/schema'
import { resolveDatabase, type DatabaseInput } from './db/types'

export type RegistryResult =
  | {
      url: string
      kind: 'mcp'
    }
  | {
      url: string
      kind: 'openapi'
      document: unknown
    }

export function registryUrl(url: string) {
  return new URL(url).toString()
}

export async function cacheRegistryResult(
  database: DatabaseInput,
  result: RegistryResult,
) {
  const db = await resolveDatabase(database)
  const now = new Date()
  await db
    .insert(registryEntry)
    .values({
      url: registryUrl(result.url),
      kind: result.kind,
      document: result.kind === 'openapi' ? result.document : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: registryEntry.url,
      set: {
        kind: result.kind,
        document: result.kind === 'openapi' ? result.document : null,
        updatedAt: now,
      },
    })
}

export async function getRegistryResult(
  database: DatabaseInput,
  url: string,
): Promise<RegistryResult | undefined> {
  const db = await resolveDatabase(database)
  const [entry] = await db
    .select({
      url: registryEntry.url,
      kind: registryEntry.kind,
      document: registryEntry.document,
    })
    .from(registryEntry)
    .where(eq(registryEntry.url, registryUrl(url)))
    .limit(1)

  if (!entry) {
    return undefined
  }
  if (entry.kind === 'openapi') {
    return {
      url: entry.url,
      kind: entry.kind,
      document: entry.document,
    }
  }
  return {
    url: entry.url,
    kind: entry.kind,
  }
}
