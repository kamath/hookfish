import { and, desc, eq } from 'drizzle-orm'
import { cachedSource } from './db/schema'
import { resolveDatabase, type DatabaseInput } from './db/types'
import type { CachedSourceMetadata } from './schemas'

function serializeCachedSource(record: {
  sourceId: string
  userId: string
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}) {
  return {
    sourceId: record.sourceId,
    userId: record.userId,
    metadata: record.metadata as CachedSourceMetadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const cachedSourceSelection = {
  sourceId: cachedSource.sourceId,
  userId: cachedSource.userId,
  metadata: cachedSource.metadata,
  createdAt: cachedSource.createdAt,
  updatedAt: cachedSource.updatedAt,
}

export async function putCachedSource(
  database: DatabaseInput,
  input: {
    userId: string
    sourceId: string
    metadata: CachedSourceMetadata
  },
) {
  const db = await resolveDatabase(database)
  const now = new Date()
  const [record] = await db
    .insert(cachedSource)
    .values({
      userId: input.userId,
      sourceId: input.sourceId,
      kind: input.metadata.kind,
      metadata: input.metadata,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [cachedSource.userId, cachedSource.sourceId],
      set: {
        kind: input.metadata.kind,
        metadata: input.metadata,
        updatedAt: now,
      },
    })
    .returning(cachedSourceSelection)

  if (!record) {
    throw new Error('Could not cache the source metadata.')
  }
  return serializeCachedSource(record)
}

export async function getCachedSource(
  database: DatabaseInput,
  userId: string,
  sourceId: string,
) {
  const db = await resolveDatabase(database)
  const [record] = await db
    .select(cachedSourceSelection)
    .from(cachedSource)
    .where(and(eq(cachedSource.userId, userId), eq(cachedSource.sourceId, sourceId)))
    .limit(1)

  return record ? serializeCachedSource(record) : null
}

export async function listCachedSources(
  database: DatabaseInput,
  userId: string,
  kind?: 'openapi' | 'mcp',
) {
  const db = await resolveDatabase(database)
  const records = await db
    .select(cachedSourceSelection)
    .from(cachedSource)
    .where(
      kind
        ? and(eq(cachedSource.userId, userId), eq(cachedSource.kind, kind))
        : eq(cachedSource.userId, userId),
    )
    .orderBy(desc(cachedSource.updatedAt))

  return records.map(serializeCachedSource)
}
