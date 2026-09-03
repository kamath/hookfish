export type SuggestedSource = {
  url: string
  title: string
  category_name: string
}

export type AppDatabase = {
  listSuggestedSources(): Promise<SuggestedSource[]>
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
