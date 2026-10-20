#!/usr/bin/env node

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Command, InvalidArgumentError } from 'commander'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import { isAddressInUse, resolveListenPort } from './listen.js'
import { attachLocalRuntime, localRuntimeResponse } from './local-runtime.js'
import { runUpdate, warnIfOutdated } from './update.js'

const SHUTDOWN_TIMEOUT_MS = 1_000

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

function listenOrigin(host: string, port: number, serverUrl?: string | URL) {
  if (host === '0.0.0.0' || host === '::' || host === '[::]') {
    return `http://127.0.0.1:${port}/`
  }
  return String(serverUrl ?? `http://${host}:${port}/`)
}

async function startServer(options: { host: string; port: number }) {
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
        // srvx installs its own SIGINT/SIGTERM handlers that close the socket
        // but never exit, which leaves Ctrl+C doing nothing.
        gracefulShutdown: false,
        hostname: options.host,
        middleware: [staticMiddleware({ dir: clientDirectory })],
        port,
        silent: true,
      })

      await server.ready()
      const listenUrl = listenOrigin(options.host, port, server.url)
      console.log(`${pkg.name} ${version} listening on ${listenUrl}`)

      let closing = false
      const shutdown = () => {
        if (closing) {
          process.exit(0)
        }
        closing = true

        // Never let a stuck connection keep the CLI alive.
        setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS).unref()
        const exit = () => process.exit(0)
        void server.close(true).then(exit, exit)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
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
