#!/usr/bin/env node

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Command, InvalidArgumentError } from 'commander'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import { isAddressInUse, resolveListenPort } from './listen.js'
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
        fetch: (request) => serverEntry.default.fetch(request),
        hostname: options.host,
        middleware: [staticMiddleware({ dir: clientDirectory })],
        port,
        silent: true,
      })

      await server.ready()
      console.log(
        `${pkg.name} ${version} listening on ${server.url ?? `http://${options.host}:${port}/`}`,
      )

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
