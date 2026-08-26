import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { asRecord } from './build-request'
import { ensureUser } from './session.functions'
import { putApiAuth } from './auth.server'

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
    await putApiAuth(username, data.apiId, fields)
    return { stored: true }
  })

export function fieldsFromForm(value: unknown): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [name, item] of Object.entries(asRecord(value))) {
    if (typeof item === 'string') {
      fields[name] = item
    }
  }
  return fields
}
