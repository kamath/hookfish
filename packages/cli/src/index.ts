#!/usr/bin/env node

import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Command, InvalidArgumentError } from 'commander'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import { isAddressInUse, resolveListenPort } from './listen.js'
import { attachLocalRuntime, localRuntimeResponse } from './local-runtime.js'
import { runUpdate, warnIfOutdated } from './update.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as {
  bin?: Record<string, string>
  name: string
  version: string
}
const { version } = pkg
const commandName = Object.keys(pkg.bin ?? {})[0] ?? pkg.name.replace(/^@[^/]+\//, '')

function parsePort(value: string): number {
  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new InvalidArgumentError('must be an integer between 1 and 65535')
  }

  return port
}

function ensureLocalPgliteDataDir() {
  if (process.env.POSTGRES_URL) {
    return
  }

  const dataDir = process.env.PGLITE_DATA_DIR ?? join(homedir(), '.hookfish', 'pglite')
  mkdirSync(dataDir, { recursive: true })
}

function warmupOrigin(host: string, port: number, serverUrl?: string | URL) {
  if (host === '0.0.0.0' || host === '::' || host === '[::]') {
    return `http://127.0.0.1:${port}/`
  }
  return String(serverUrl ?? `http://${host}:${port}/`)
}

async function warmupLocalApp(listenUrl: string) {
  try {
    await fetch(new URL('/api/registry/feed', listenUrl), {
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    // First browser request can still finish database setup.
  }
}

async function startServer(options: { host: string; port: number }) {
  ensureLocalPgliteDataDir()

  const serverEntryUrl = pathToFileURL(
    fileURLToPath(new URL('../web/server/server.js', import.meta.url)),
  )
  const clientDirectory = fileURLToPath(
    new URL('../web/client/', import.meta.url),
  )
  const serverEntry = (await import(serverEntryUrl.href)) as {
    default: {
      fetch(request: Request): Response | Promise<Response>
    }
  }

  let port = options.port
  while (port <= 65_535) {
    port = await resolveListenPort(options.host, port)
    try {
      const server = serve({
        fetch: async (request) => {
          const url = new URL(request.url)
          if (url.pathname === '/__hookfish.json') {
            return localRuntimeResponse(port)
          }
          const response = await serverEntry.default.fetch(request)
          return attachLocalRuntime(response, port)
        },
        hostname: options.host,
        middleware: [staticMiddleware({ dir: clientDirectory })],
        port,
        silent: true,
      })

      await server.ready()
      const listenUrl = warmupOrigin(options.host, port, server.url)
      await warmupLocalApp(listenUrl)
      console.log(`${pkg.name} ${version} listening on ${listenUrl}`)

      const shutdown = async () => {
        await server.close(true)
      }

      process.once('SIGINT', shutdown)
      process.once('SIGTERM', shutdown)
      return
    } catch (error) {
      if (isAddressInUse(error) && port < 65_535) {
        port += 1
        continue
      }
      throw error
    }
  }

  throw new Error(`No free port found from ${options.port} to 65535`)
}

const program = new Command()
  .name(commandName)
  .description('Run the Hookfish OpenAPI client locally')
  .version(version)

program
  .command('up')
  .description('Start the local server')
  .option('-p, --port <number>', 'port to listen on', parsePort, 3000)
  .option('--host <host>', 'host to listen on', '127.0.0.1')
  .action(async (options) => {
    try {
      await startServer(options)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  })

program
  .command('update')
  .description('Install the latest version from npm')
  .option('--dry-run', 'print the install command without running it')
  .action(async (options: { dryRun?: boolean }) => {
    process.exitCode = await runUpdate({
      dryRun: options.dryRun,
      name: pkg.name,
      version,
    })
  })

program.action(() => {
  program.outputHelp()
})

const [command] = process.argv.slice(2)
if (command !== 'update') {
  await warnIfOutdated({
    commandName,
    name: pkg.name,
    version,
  })
}

await program.parseAsync()
