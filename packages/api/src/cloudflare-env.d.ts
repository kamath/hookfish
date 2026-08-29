declare module 'cloudflare:workers' {
  export const env: {
    HYPERDRIVE?: { connectionString: string }
    POSTGRES_URL?: string
    BETTER_AUTH_SECRET?: string
    BETTER_AUTH_URL?: string
    PGLITE_DATA_DIR?: string
  }
}
