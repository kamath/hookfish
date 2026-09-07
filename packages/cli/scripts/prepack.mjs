import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceDirectory = resolve(cliDirectory, '../..')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

// `pnpm pack` / `npm publish` do not run Turbo, so prepack builds the Node
// example first, then compiles this package and copies `web/` into the tarball.
run(
  'pnpm',
  ['exec', 'turbo', 'run', 'build', '--filter=@hookfish/example-node'],
  workspaceDirectory,
)
run('pnpm', ['run', 'build'], cliDirectory)
