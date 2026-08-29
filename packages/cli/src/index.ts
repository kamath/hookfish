#!/usr/bin/env node

import { createConnection } from 'node:net'
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

function canConnect(host: string, port: number): Promise<boolean> {
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

async function assertListenTargetAvailable(host: string, port: number) {
  const hosts = new Set([host, '127.0.0.1', '::1'])

  for (const candidate of hosts) {
    if (await canConnect(candidate, port)) {
      throw new Error(
        `Port ${port} is already in use on ${candidate}. Stop \`pnpm dev\` or that other listener, or pass --port.`,
      )
    }
  }
}

async function startServer(options: { host: string; port: number }) {
  await assertListenTargetAvailable(options.host, options.port)

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
    silent: true,
  })

  await server.ready()
  console.log(
    `Smithery CLI ${version} listening on ${server.url ?? `http://${options.host}:${options.port}/`}`,
  )

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
  .action(async (options) => {
    try {
      await startServer(options)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  })

await program.parseAsync()
