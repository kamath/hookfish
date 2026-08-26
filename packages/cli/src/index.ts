#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Command, InvalidArgumentError } from 'commander'

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
  const serverEntry = fileURLToPath(
    new URL('../web/server/index.mjs', import.meta.url),
  )
  const child = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      HOST: options.host,
      PORT: String(options.port),
    },
    stdio: 'inherit',
  })

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.once('SIGINT', forwardSignal)
  process.once('SIGTERM', forwardSignal)

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', forwardSignal)
      process.removeListener('SIGTERM', forwardSignal)

      if (signal) {
        process.exitCode = 128 + (signal === 'SIGINT' ? 2 : 15)
      } else {
        process.exitCode = code ?? 1
      }
      resolve()
    })
  })
}

const program = new Command()
  .name('hookfish')
  .description('Run the Hookfish OpenAPI client locally')
  .version(version)
  .option('-p, --port <number>', 'port to listen on', parsePort, 3000)
  .option('--host <host>', 'host to listen on', '127.0.0.1')
  .action(startServer)

await program.parseAsync()
