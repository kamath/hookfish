import { getRequest } from '@tanstack/react-start/server'
import { getDb } from './db.server'
import { USERNAME } from './username'

const requestUsernames = new WeakMap<Request, string>()

export async function ensureUser(): Promise<string> {
  const request = getRequest()
  const cached = requestUsernames.get(request)
  if (cached) {
    return cached
  }

  const db = await getDb()
  await db
    .prepare('INSERT OR IGNORE INTO users (username) VALUES (?)')
    .bind(USERNAME)
    .run()
  await db
    .prepare('UPDATE apis SET username = ? WHERE username != ?')
    .bind(USERNAME, USERNAME)
    .run()
  requestUsernames.set(request, USERNAME)
  return USERNAME
}
