import { drizzle } from 'drizzle-orm/postgres-js'
import { asc, eq, inArray } from 'drizzle-orm'
import postgres from 'postgres'
import { registry, schema, tags } from './schema'
import type { AppDatabase } from './types'

export type PostgresConnection = string | { connectionString: string }

export function createPostgresDb(connection: PostgresConnection): AppDatabase {
  const connectionString =
    typeof connection === 'string' ? connection : connection.connectionString
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString.trim())) {
    throw new Error(
      'Postgres requires a postgres:// or postgresql:// connection string.',
    )
  }

  const client = postgres(connectionString.trim(), {
    max: 5,
    fetch_types: false,
    prepare: true,
  })
  const database = drizzle({ client, schema })
  return {
    async listRegistryFeedRows(feedTags) {
      const rows = await database
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
      return rows
    },
  }
}
