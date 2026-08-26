import { createServerFn } from '@tanstack/react-start'
import { ensureUser } from './session.server'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const username = await ensureUser()
  return { username }
})
