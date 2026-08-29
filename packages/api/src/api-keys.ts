import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { apiKey, user } from './db/schema'
import { resolveDatabase, type DatabaseInput } from './db/types'
import type { AuthUser } from './schemas'

export const apiKeyExpirations = ['1 day', '7 days', '30 days', '90 days', 'never'] as const

export type ApiKeyExpiration = (typeof apiKeyExpirations)[number]

const expirationDays: Record<Exclude<ApiKeyExpiration, 'never'>, number> = {
  '1 day': 1,
  '7 days': 7,
  '30 days': 30,
  '90 days': 90,
}

function expirationDate(expiration: ApiKeyExpiration, now = new Date()) {
  if (expiration === 'never') {
    return null
  }
  return new Date(now.getTime() + expirationDays[expiration] * 24 * 60 * 60 * 1000)
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function hashApiKey(key: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function mintSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `hf_${encodeBase64Url(bytes)}`
}

function serializeApiKey(record: { name: string; expiresAt: Date | null }) {
  return {
    name: record.name,
    expiresAt: record.expiresAt?.toISOString() ?? null,
  }
}

export async function createApiKey(
  database: DatabaseInput,
  input: { userId: string; name: string; expiration: ApiKeyExpiration },
) {
  const db = await resolveDatabase(database)
  const key = mintSecret()
  const expiresAt = expirationDate(input.expiration)
  const [created] = await db
    .insert(apiKey)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      keyHash: await hashApiKey(key),
      expiresAt,
      userId: input.userId,
    })
    .returning({ name: apiKey.name, expiresAt: apiKey.expiresAt })

  if (!created) {
    throw new Error('Could not create the API key.')
  }

  return { ...serializeApiKey(created), key }
}

export async function listApiKeys(database: DatabaseInput, userId: string) {
  const db = await resolveDatabase(database)
  const records = await db
    .select({ name: apiKey.name, expiresAt: apiKey.expiresAt })
    .from(apiKey)
    .where(eq(apiKey.userId, userId))
    .orderBy(desc(apiKey.createdAt))

  return records.map(serializeApiKey)
}

export async function resolveApiKeyUser(
  database: DatabaseInput,
  key: string,
): Promise<AuthUser | null> {
  const db = await resolveDatabase(database)
  const [record] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      emailVerified: user.emailVerified,
    })
    .from(apiKey)
    .innerJoin(user, eq(apiKey.userId, user.id))
    .where(
      and(
        eq(apiKey.keyHash, await hashApiKey(key)),
        or(isNull(apiKey.expiresAt), gt(apiKey.expiresAt, new Date())),
      ),
    )
    .limit(1)

  return record ?? null
}
