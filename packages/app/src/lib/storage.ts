import { atom } from 'jotai'
import { store } from './chrome'

const APIS_KEY = 'oc:apis'

function browserStorage() {
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.localStorage
}

function readJson<T>(key: string, fallback: T): T {
  const storage = browserStorage()
  if (!storage) {
    return fallback
  }

  const raw = storage.getItem(key)
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    storage.removeItem(key)
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  const storage = browserStorage()
  if (!storage) {
    return
  }
  storage.setItem(key, JSON.stringify(value))
}

export function readApisJson() {
  return readJson(APIS_KEY, [] as unknown)
}

export function writeApisJson(value: unknown) {
  writeJson(APIS_KEY, value)
}

// Credentials live only in memory: a reload or a new tab starts signed out, and nothing
// written to disk outlives the page.
type Credentials = Record<string, Record<string, string>>

const credentialsAtom = atom<{ auth: Credentials; headers: Credentials }>({
  auth: {},
  headers: {},
})

const LEGACY_CREDENTIAL_PREFIXES = ['oc:auth:', 'oc:headers:', 'oc:mcp-oauth:']

// Earlier builds kept credentials in localStorage. Wipe them so they don't linger on disk.
function purgeLegacyCredentials() {
  const storage = browserStorage()
  if (!storage || typeof storage.key !== 'function') {
    return
  }
  const stale: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && LEGACY_CREDENTIAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      stale.push(key)
    }
  }
  for (const key of stale) {
    storage.removeItem(key)
  }
}

purgeLegacyCredentials()

function writeCredentials(
  kind: 'auth' | 'headers',
  apiId: string,
  fields: Record<string, string>,
) {
  const credentials = store.get(credentialsAtom)
  const next = { ...credentials[kind] }
  if (Object.keys(fields).length === 0) {
    delete next[apiId]
  } else {
    next[apiId] = { ...fields }
  }
  store.set(credentialsAtom, { ...credentials, [kind]: next })
}

export function readAuth(apiId: string) {
  return { ...store.get(credentialsAtom).auth[apiId] }
}

export function writeAuth(apiId: string, fields: Record<string, string>) {
  writeCredentials('auth', apiId, fields)
}

export function clearAuth(apiId: string) {
  writeCredentials('auth', apiId, {})
}

export function readHeaders(apiId: string) {
  return { ...store.get(credentialsAtom).headers[apiId] }
}

export function writeHeaders(apiId: string, headers: Record<string, string>) {
  writeCredentials('headers', apiId, headers)
}

export function clearHeaders(apiId: string) {
  writeCredentials('headers', apiId, {})
}
