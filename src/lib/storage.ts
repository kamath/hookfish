const APIS_KEY = 'oc:apis'

function authKey(apiId: string) {
  return `oc:auth:${apiId}`
}

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

export function readAuth(apiId: string) {
  return readJson<Record<string, string>>(authKey(apiId), {})
}

export function writeAuth(apiId: string, fields: Record<string, string>) {
  if (Object.keys(fields).length === 0) {
    browserStorage()?.removeItem(authKey(apiId))
    return
  }
  writeJson(authKey(apiId), fields)
}

export function clearAuth(apiId: string) {
  browserStorage()?.removeItem(authKey(apiId))
}
