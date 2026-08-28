#!/usr/bin/env node

import { spawn, type SpawnOptions } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const REPO = 'kamath/hookfish'
export const REPO_URL = `https://github.com/${REPO}.git`

export const USAGE =
  'Usage: pnpm cli:gh <branch> [-- <hookfish options>]\n' +
  `Clone ${REPO} at <branch>, build apps/web in node mode, and start the CLI.`

export type ParsedCliGhArgs =
  | { kind: 'help' }
  | { kind: 'error'; error: string }
  | { kind: 'run'; branch: string; forwarded: string[] }

export type RunFn = (
  command: string,
  args: readonly string[],
  options?: SpawnOptions,
) => Promise<void>

export function parseCliGhArgs(argv: string[]): ParsedCliGhArgs {
  const args = argv.filter((arg) => arg !== '--')

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { kind: 'help' }
  }

  const [branch, ...forwarded] = args

  if (!branch || branch.startsWith('-')) {
    return { kind: 'error', error: 'a branch name is required before options' }
  }

  return { kind: 'run', branch, forwarded }
}

export function cloneArgs(branch: string, directory: string): string[] {
  return [
    'clone',
    '--depth',
    '1',
    '--single-branch',
    '--branch',
    branch,
    REPO_URL,
    directory,
  ]
}

function run(command: string, args: readonly string[], options: SpawnOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    })

    const forward = (signal: NodeJS.Signals) => {
      if (!child.killed) {
        child.kill(signal)
      }
    }

    process.once('SIGINT', forward)
    process.once('SIGTERM', forward)

    child.once('error', (error) => {
      process.removeListener('SIGINT', forward)
      process.removeListener('SIGTERM', forward)
      reject(error)
    })

    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', forward)
      process.removeListener('SIGTERM', forward)

      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        resolve()
        return
      }

      if (signal) {
        reject(new Error(`${command} exited via ${signal}`))
        return
      }

      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
        return
      }

      resolve()
    })
  })
}

export async function runBranch(
  branch: string,
  forwarded: string[],
  options: {
    run?: RunFn
    createTempDir?: () => Promise<string>
    removeDir?: (directory: string) => Promise<void>
  } = {},
) {
  const runCommand = options.run ?? run
  const createTempDir =
    options.createTempDir ?? (() => mkdtemp(join(tmpdir(), 'hookfish-cli-gh-')))
  const removeDir =
    options.removeDir ?? ((directory) => rm(directory, { recursive: true, force: true }))

  const directory = await createTempDir()

  try {
    await runCommand('git', cloneArgs(branch, directory))
    await runCommand('pnpm', ['install'], { cwd: directory })
    await runCommand('pnpm', ['--filter', '@hookfish/web', 'build:node'], {
      cwd: directory,
    })
    await runCommand('pnpm', ['--filter', 'hookfish', 'build'], {
      cwd: directory,
    })
    await runCommand(
      'pnpm',
      ['--filter', 'hookfish', 'start', '--', ...forwarded],
      { cwd: directory },
    )
  } finally {
    await removeDir(directory)
  }
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseCliGhArgs(argv)

  if (parsed.kind === 'help') {
    console.log(USAGE)
    return 0
  }

  if (parsed.kind === 'error') {
    console.error(parsed.error)
    console.error(USAGE)
    return 1
  }

  await runBranch(parsed.branch, parsed.forwarded)
  return 0
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  try {
    process.exitCode = await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
