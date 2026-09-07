import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliDirectory = resolve(root, 'packages/cli')
const pkg = JSON.parse(readFileSync(resolve(cliDirectory, 'package.json'), 'utf8'))

const env = { ...process.env }
delete env.NODE_AUTH_TOKEN
delete env.NPM_TOKEN
delete env.NPM_CONFIG_USERCONFIG

const publish = spawnSync('npm', ['publish', '--access', 'public'], {
  cwd: cliDirectory,
  env,
  stdio: 'inherit',
})

if (publish.status !== 0) {
  process.exit(publish.status ?? 1)
}

// changesets/action parses this line to create GitHub releases and push tags.
console.log(`New tag: ${pkg.name}@${pkg.version}`)
