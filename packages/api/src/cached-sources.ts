import { desc, eq } from 'drizzle-orm'
import { cachedSource } from './db/schema'
import { resolveDatabase, type DatabaseInput } from './db/types'
import type { CachedSourceMetadata } from './schemas'

type CachedSourceRecord = {
  sourceId: string
  createdByUserId: string | null
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

function metadataFor(record: CachedSourceRecord) {
  return record.metadata as CachedSourceMetadata
}

function serializeCachedSource(record: CachedSourceRecord) {
  return {
    sourceId: record.sourceId,
    createdByUserId: record.createdByUserId,
    metadata: metadataFor(record),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function summarizeCachedSource(record: ReturnType<typeof serializeCachedSource>) {
  return {
    sourceId: record.sourceId,
    createdByUserId: record.createdByUserId,
    kind: record.metadata.kind,
    title: record.metadata.title,
    version: record.metadata.version,
    executableCount: record.metadata.executables.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

const cachedSourceSelection = {
  sourceId: cachedSource.sourceId,
  createdByUserId: cachedSource.createdByUserId,
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
      createdByUserId: input.userId,
      sourceId: input.sourceId,
      kind: input.metadata.kind,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: cachedSource.sourceId,
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
  sourceId: string,
) {
  const db = await resolveDatabase(database)
  const [record] = await db
    .select(cachedSourceSelection)
    .from(cachedSource)
    .where(eq(cachedSource.sourceId, sourceId))
    .limit(1)

  return record ? serializeCachedSource(record) : null
}

export async function listCachedSources(
  database: DatabaseInput,
  kind?: 'openapi' | 'mcp',
) {
  const db = await resolveDatabase(database)
  const records = await db
    .select(cachedSourceSelection)
    .from(cachedSource)
    .where(kind ? eq(cachedSource.kind, kind) : undefined)
    .orderBy(desc(cachedSource.updatedAt))

  return records.map((record: CachedSourceRecord) =>
    summarizeCachedSource(serializeCachedSource(record)),
  )
}
