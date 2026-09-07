import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'packages/cli/package.json'), 'utf8'))

const publish = spawnSync(
  'pnpm',
  ['--filter', 'hookfish', 'publish', '--access', 'public'],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
)

if (publish.status !== 0) {
  process.exit(publish.status ?? 1)
}

// changesets/action parses this line to create GitHub releases and push tags.
console.log(`New tag: ${pkg.name}@${pkg.version}`)
