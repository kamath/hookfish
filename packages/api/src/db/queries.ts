import { asc, eq, inArray } from 'drizzle-orm'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { registry, schema, tags } from './schema'
import type { RegistryEntry, RegistryFeedRow } from './types'

export type SchemaDatabase =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>

export async function listRegistryFeedRows(
  database: SchemaDatabase,
  feedTags: readonly string[],
): Promise<RegistryFeedRow[]> {
  return database
    .select({
      url: registry.url,
      title: registry.title,
      type: registry.type,
      tag: tags.tag,
    })
    .from(registry)
    .innerJoin(tags, eq(tags.registryRowId, registry.rowId))
    .where(inArray(tags.tag, feedTags))
    .orderBy(asc(tags.tag), asc(registry.title))
}

export async function upsertRegistryEntry(
  database: SchemaDatabase,
  entry: RegistryEntry,
): Promise<void> {
  await database
    .insert(registry)
    .values({
      url: entry.url,
      title: entry.title,
      type: entry.type,
    })
    .onConflictDoUpdate({
      target: registry.url,
      set: {
        title: entry.title,
        type: entry.type,
      },
    })
}
