#!/usr/bin/env node

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Command, InvalidArgumentError } from 'commander'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

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
  const server = serve({
    fetch: (request) => serverEntry.default.fetch(request),
    hostname: options.host,
    middleware: [staticMiddleware({ dir: clientDirectory })],
    port: options.port,
  })

  await server.ready()

  const shutdown = async () => {
    await server.close(true)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

const program = new Command()
  .name('hookfish')
  .description('Run the Smithery OpenAPI client locally')
  .version(version)
  .allowExcessArguments()
  .option('-p, --port <number>', 'port to listen on', parsePort, 3000)
  .option('--host <host>', 'host to listen on', '127.0.0.1')
  .action(startServer)

await program.parseAsync()
