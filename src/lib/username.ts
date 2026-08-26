import { readUsername, writeUsername } from './storage'
import { ADJECTIVES, NOUNS } from './words'

const USERNAME_RE = /^[a-z]+-[a-z]+-\d+$/

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export function createUsername() {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(Math.random() * 100)}`
}

export function ensureUsername(): string {
  const existing = readUsername()
  if (existing && USERNAME_RE.test(existing)) {
    return existing
  }

  const username = createUsername()
  writeUsername(username)
  return username
}
