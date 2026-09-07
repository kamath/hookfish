import { spawnSync } from 'node:child_process'

export type UpdateInvocation = {
  args: string[]
  command: string
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

export function compareVersions(left: string, right: string): number {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (delta !== 0) {
      return delta < 0 ? -1 : 1
    }
  }

  return 0
}

export function updateWarning(commandName: string, current: string, latest: string): string {
  return `A newer ${commandName} is available (${latest}; current ${current}). Run \`${commandName} update\`.`
}

export function shouldSkipUpdateCheck(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.HOOKFISH_SKIP_UPDATE_CHECK
  return value === '1' || value === 'true'
}

export function resolveRegistryUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.HOOKFISH_NPM_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/$/, '')
}

export function latestPackageUrl(packageName: string, registry = resolveRegistryUrl()): string {
  return `${registry}/${encodeURIComponent(packageName)}/latest`
}

export async function fetchLatestVersion(
  packageName: string,
  options: {
    env?: NodeJS.ProcessEnv
    fetchImpl?: typeof fetch
    timeoutMs?: number
  } = {},
): Promise<string | undefined> {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 2_500
  const url = latestPackageUrl(packageName, resolveRegistryUrl(env))

  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      return undefined
    }

    const body = (await response.json()) as { version?: unknown }
    return typeof body.version === 'string' && body.version.length > 0 ? body.version : undefined
  } catch {
    return undefined
  }
}

export function resolveUpdateInvocation(
  packageName: string,
  env: NodeJS.ProcessEnv = process.env,
): UpdateInvocation {
  const spec = `${packageName}@latest`
  const userAgent = env.npm_config_user_agent ?? ''

  if (userAgent.includes('pnpm')) {
    return { command: 'pnpm', args: ['add', '--global', spec] }
  }
  if (userAgent.includes('yarn')) {
    return { command: 'yarn', args: ['global', 'add', spec] }
  }
  if (userAgent.includes('bun')) {
    return { command: 'bun', args: ['add', '--global', spec] }
  }

  return { command: 'npm', args: ['install', '--global', spec] }
}

export async function warnIfOutdated(options: {
  commandName: string
  env?: NodeJS.ProcessEnv
  name: string
  stderr?: NodeJS.WritableStream
  version: string
}): Promise<void> {
  const env = options.env ?? process.env
  if (shouldSkipUpdateCheck(env)) {
    return
  }

  const latest = await fetchLatestVersion(options.name, { env })
  if (!latest || !isNewerVersion(latest, options.version)) {
    return
  }

  const stream = options.stderr ?? process.stderr
  stream.write(`${updateWarning(options.commandName, options.version, latest)}\n`)
}

export async function runUpdate(options: {
  dryRun?: boolean
  env?: NodeJS.ProcessEnv
  name: string
  spawn?: typeof spawnSync
  stderr?: NodeJS.WritableStream
  stdout?: NodeJS.WritableStream
  version: string
}): Promise<number> {
  const env = options.env ?? process.env
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const latest = await fetchLatestVersion(options.name, { env, timeoutMs: 10_000 })

  if (!latest) {
    stderr.write(`Could not look up ${options.name} on npm.\n`)
    return 1
  }

  if (!isNewerVersion(latest, options.version)) {
    stdout.write(`${options.name} is already the latest version (${options.version}).\n`)
    return 0
  }

  const invocation = resolveUpdateInvocation(options.name, env)
  const printed = `${invocation.command} ${invocation.args.join(' ')}`
  stdout.write(`Updating ${options.name} from ${options.version} to ${latest}.\n`)
  stdout.write(`${printed}\n`)

  if (options.dryRun) {
    return 0
  }

  const result = (options.spawn ?? spawnSync)(invocation.command, invocation.args, {
    env,
    stdio: 'inherit',
  })

  if (result.error) {
    stderr.write(`${result.error.message}\n`)
    return 1
  }

  return result.status === 0 ? 0 : (result.status ?? 1)
}

function versionParts(value: string): number[] {
  const [core] = value.trim().replace(/^v/i, '').split('-')
  return (core ?? '0').split('.').map((part) => {
    const parsed = Number.parseInt(part, 10)
    return Number.isFinite(parsed) ? parsed : 0
  })
}
