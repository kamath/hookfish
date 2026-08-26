import { ensureUser } from './session.server'
import { userVault } from './vault.server'

export async function putApiAuth(
  username: string,
  apiId: string,
  fields: Record<string, string>,
) {
  await userVault(username).put(apiId, fields)
}

export async function readApiAuth(apiId: string): Promise<Record<string, string>> {
  const username = await ensureUser()
  return userVault(username).get(apiId)
}

export async function apiAuthStored(apiId: string): Promise<boolean> {
  const username = await ensureUser()
  return userVault(username).has(apiId)
}

export async function clearApiAuth(apiId: string) {
  const username = await ensureUser()
  await userVault(username).clear(apiId)
}
