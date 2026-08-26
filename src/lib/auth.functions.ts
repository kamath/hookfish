import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { asRecord } from './build-request'
import { ensureUser } from './session.functions'
import { userVault } from './vault.server'

export const saveApiAuth = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      apiId: z.string(),
      fields: z.record(z.string(), z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const username = await ensureUser()
    const fields: Record<string, string> = {}
    for (const [name, value] of Object.entries(data.fields)) {
      if (value.trim()) {
        fields[name] = value
      }
    }
    await userVault(username).put(data.apiId, fields)
    return { stored: true }
  })

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

export function fieldsFromForm(value: unknown): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [name, item] of Object.entries(asRecord(value))) {
    if (typeof item === 'string') {
      fields[name] = item
    }
  }
  return fields
}
