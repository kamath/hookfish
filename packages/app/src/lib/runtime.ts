const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export type HomepageLaunchHint =
  | { kind: 'local'; port: string }
  | { kind: 'hosted' }

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

export function homepageLaunchHint(location: {
  hostname: string
  port: string
  protocol: string
}): HomepageLaunchHint {
  const port = localListenPort(location)
  return port ? { kind: 'local', port } : { kind: 'hosted' }
}
