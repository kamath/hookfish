import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { schema } from './schema'

export type PostgresConnection = string | { connectionString: string }

export function createPostgresDb(connection: PostgresConnection) {
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
  return drizzle({ client, schema })
}
