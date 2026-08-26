import { env } from 'cloudflare:workers'

export function userVault(username: string) {
  if (!env.VAULT) {
    throw new Error('Durable Object binding VAULT is missing. Check wrangler.jsonc.')
  }
  return env.VAULT.getByName(username)
}
