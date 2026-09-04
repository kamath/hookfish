export type RegistryEntry = {
  url: string
  title: string
  type: 'MCP' | 'API'
}

export type RegistryFeedRow = RegistryEntry & {
  tag: string
}

export type AppDatabase = {
  listRegistryFeedRows(tags: readonly string[]): Promise<RegistryFeedRow[]>
  upsertRegistryEntry(entry: RegistryEntry): Promise<void>
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
