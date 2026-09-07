import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliDirectory = resolve(root, 'packages/cli')
const pkg = JSON.parse(readFileSync(resolve(cliDirectory, 'package.json'), 'utf8'))
const tag = `${pkg.name}@${pkg.version}`

const env = { ...process.env }
delete env.NODE_AUTH_TOKEN
delete env.NPM_TOKEN
delete env.NPM_CONFIG_USERCONFIG

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  })
}

const publishedVersion = run('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], {
  cwd: cliDirectory,
  env,
})
const alreadyPublished = publishedVersion.status === 0 && publishedVersion.stdout.trim() === pkg.version

if (!alreadyPublished) {
  const publish = run('npm', ['publish', '--access', 'public'], {
    cwd: cliDirectory,
    env,
    stdio: 'inherit',
  })

  if (publish.status !== 0) {
    process.exit(publish.status ?? 1)
  }
}

const remoteTag = run('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`], {
  cwd: root,
})

if (remoteTag.status === 0) {
  console.log(`${tag} is already on npm and origin; nothing to tag.`)
  process.exit(0)
}

const existingTag = run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
  cwd: root,
})

if (existingTag.status !== 0) {
  const tagged = run('git', ['tag', tag], {
    cwd: root,
    stdio: 'inherit',
  })

  if (tagged.status !== 0) {
    process.exit(tagged.status ?? 1)
  }
}

// changesets/action parses this line, then pushes the tag and opens a GitHub release.
console.log(`New tag: ${tag}`)
