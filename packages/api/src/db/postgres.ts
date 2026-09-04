import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { listRegistryFeedRows, upsertRegistryEntry } from './queries'
import { schema } from './schema'
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
    listRegistryFeedRows: (feedTags) => listRegistryFeedRows(database, feedTags),
    upsertRegistryEntry: (entry) => upsertRegistryEntry(database, entry),
  }
}
