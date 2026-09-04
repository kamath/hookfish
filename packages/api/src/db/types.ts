export type RegistryFeedRow = {
  url: string
  title: string
  type: 'MCP' | 'API'
  tag: string
}

export type AppDatabase = {
  listRegistryFeedRows(tags: readonly string[]): Promise<RegistryFeedRow[]>
}

export type DatabaseInput =
  | AppDatabase
  | PromiseLike<AppDatabase>
  | (() => AppDatabase | PromiseLike<AppDatabase>)

export function resolveDatabase(database: DatabaseInput) {
  return Promise.resolve(
    typeof database === 'function' ? database() : database,
  )
}
