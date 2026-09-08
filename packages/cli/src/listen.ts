import { createConnection } from 'node:net'

const MAX_PORT = 65_535

export function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    socket.setTimeout(250)
    const done = (open: boolean) => {
      socket.destroy()
      resolve(open)
    }
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

export async function isListenTargetTaken(host: string, port: number): Promise<boolean> {
  const hosts = new Set([host, '127.0.0.1', '::1'])

  for (const candidate of hosts) {
    if (await canConnect(candidate, port)) {
      return true
    }
  }

  return false
}

export function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  )
}

export async function resolveListenPort(host: string, startPort: number): Promise<number> {
  for (let port = startPort; port <= MAX_PORT; port++) {
    if (!(await isListenTargetTaken(host, port))) {
      return port
    }
  }

  throw new Error(`No free port found from ${startPort} to ${MAX_PORT}`)
}
