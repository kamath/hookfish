import { drizzle } from 'drizzle-orm/postgres-js'
import { asc } from 'drizzle-orm'
import postgres from 'postgres'
import { schema, suggestedSource } from './schema'
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
    async listSuggestedSources() {
      const rows = await database
        .select()
        .from(suggestedSource)
        .orderBy(asc(suggestedSource.categoryName), asc(suggestedSource.title))
      return rows.map((row) => ({
        url: row.url,
        title: row.title,
        category_name: row.categoryName,
        type: row.type,
      }))
    },
  }
}
