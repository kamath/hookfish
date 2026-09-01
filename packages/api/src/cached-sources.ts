import { and, desc, eq, or } from 'drizzle-orm'
import { cachedSource } from './db/schema'
import { resolveDatabase, type DatabaseInput } from './db/types'
import type { RegistryEntryMetadata } from './schemas'

type CachedSourceRecord = {
  sourceId: string
  sourceUrl: string
  createdByUserId: string | null
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

function metadataFor(record: CachedSourceRecord) {
  return record.metadata as RegistryEntryMetadata
}

function serializeCachedSource(record: CachedSourceRecord) {
  return {
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
    createdByUserId: record.createdByUserId,
    metadata: metadataFor(record),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function summarizeCachedSource(record: ReturnType<typeof serializeCachedSource>) {
  return {
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
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
  sourceUrl: cachedSource.sourceUrl,
  createdByUserId: cachedSource.createdByUserId,
  metadata: cachedSource.metadata,
  createdAt: cachedSource.createdAt,
  updatedAt: cachedSource.updatedAt,
}

export class RegistrySourceMismatchError extends Error {}
export class RegistryUpdateForbiddenError extends Error {}

export async function putCachedSource(
  database: DatabaseInput,
  input: {
    userId: string
    sourceId: string
    sourceUrl: string
    metadata: RegistryEntryMetadata
  },
) {
  const db = await resolveDatabase(database)
  const now = new Date()
  const findConflicts = async (): Promise<CachedSourceRecord[]> =>
    db
      .select(cachedSourceSelection)
      .from(cachedSource)
      .where(
        or(
          eq(cachedSource.sourceId, input.sourceId),
          and(
            eq(cachedSource.kind, input.metadata.kind),
            eq(cachedSource.sourceUrl, input.sourceUrl),
          ),
        ),
      )
      .limit(2)

  const conflicts = await findConflicts()
  const existingById = conflicts.find(
    (record) => record.sourceId === input.sourceId,
  )

  if (existingById) {
    if (
      existingById.sourceUrl !== input.sourceUrl ||
      metadataFor(existingById).kind !== input.metadata.kind
    ) {
      throw new RegistrySourceMismatchError(
        'This registry source ID is already bound to a different source.',
      )
    }
    if (existingById.createdByUserId !== input.userId) {
      throw new RegistryUpdateForbiddenError(
        'Only the original submitter can update this registry entry.',
      )
    }
    const [updated] = await db
      .update(cachedSource)
      .set({
        kind: input.metadata.kind,
        metadata: input.metadata,
        updatedAt: now,
      })
      .where(eq(cachedSource.sourceId, input.sourceId))
      .returning(cachedSourceSelection)
    if (!updated) {
      throw new Error('Could not update the registry entry.')
    }
    return serializeCachedSource(updated)
  }

  const existingByUrl = conflicts.find(
    (record) =>
      metadataFor(record).kind === input.metadata.kind &&
      record.sourceUrl === input.sourceUrl,
  )
  if (existingByUrl) {
    return serializeCachedSource(existingByUrl)
  }

  const [record] = await db
    .insert(cachedSource)
    .values({
      createdByUserId: input.userId,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      kind: input.metadata.kind,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning(cachedSourceSelection)

  if (record) {
    return serializeCachedSource(record)
  }

  const concurrentConflicts = await findConflicts()
  const conflictingId = concurrentConflicts.find(
    (candidate) => candidate.sourceId === input.sourceId,
  )
  if (
    conflictingId &&
    (conflictingId.sourceUrl !== input.sourceUrl ||
      metadataFor(conflictingId).kind !== input.metadata.kind)
  ) {
    throw new RegistrySourceMismatchError(
      'This registry source ID is already bound to a different source.',
    )
  }
  if (
    conflictingId &&
    conflictingId.createdByUserId !== input.userId
  ) {
    throw new RegistryUpdateForbiddenError(
      'Only the original submitter can update this registry entry.',
    )
  }
  const concurrentEntry =
    conflictingId ??
    concurrentConflicts.find(
      (candidate) =>
        metadataFor(candidate).kind === input.metadata.kind &&
        candidate.sourceUrl === input.sourceUrl,
    )
  if (!concurrentEntry) {
    throw new Error('Could not create the registry entry.')
  }
  return serializeCachedSource(concurrentEntry)
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
