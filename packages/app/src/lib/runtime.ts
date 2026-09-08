const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export type HomepageLaunchHint =
  | { kind: 'local'; port: string }
  | { kind: 'hosted' }

export type LocalRuntime = {
  local?: boolean
  port?: number | string
}

declare global {
  interface Window {
    __HOOKFISH_RUNTIME__?: LocalRuntime
  }
}

export function localListenPort(location: {
  hostname: string
  port: string
  protocol: string
}): string | undefined {
  if (!LOOPBACK_HOSTS.has(location.hostname)) {
    return undefined
  }
  if (location.port) {
    return location.port
  }
  return location.protocol === 'https:' ? '443' : '80'
}

export function readLocalRuntime(
  runtime?: LocalRuntime | null,
): LocalRuntime | undefined {
  if (runtime) {
    return runtime
  }
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.__HOOKFISH_RUNTIME__
}

export function homepageLaunchHint(
  location: {
    hostname: string
    port: string
    protocol: string
  },
  runtime?: LocalRuntime | null,
): HomepageLaunchHint {
  const injected = readLocalRuntime(runtime)
  if (injected?.local && injected.port != null && String(injected.port) !== '') {
    return { kind: 'local', port: String(injected.port) }
  }
  const port = localListenPort(location)
  return port ? { kind: 'local', port } : { kind: 'hosted' }
}
