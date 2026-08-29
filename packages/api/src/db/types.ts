import type { drizzleAdapter } from '@better-auth/drizzle-adapter'

export type AppDatabase = Parameters<typeof drizzleAdapter>[0]

export type DatabaseInput =
  | AppDatabase
  | PromiseLike<AppDatabase>
  | (() => AppDatabase | PromiseLike<AppDatabase>)

export function resolveDatabase(database: DatabaseInput) {
  return Promise.resolve(
    typeof database === 'function' ? database() : database,
  )
}
