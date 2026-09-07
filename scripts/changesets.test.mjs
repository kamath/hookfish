import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function workspacePackages() {
  const workspace = read('pnpm-workspace.yaml')
  const packageJsonPaths = ['packages/api', 'packages/app', 'packages/cli', 'examples/cloudflare', 'examples/docker', 'examples/node', 'examples/vercel']
    .map((directory) => resolve(root, directory, 'package.json'))

  assert.match(workspace, /packages\/\*/)
  assert.match(workspace, /examples\/\*/)

  return packageJsonPaths.map((path) => JSON.parse(readFileSync(path, 'utf8')))
}

test('changesets version only the hookfish CLI', () => {
  const config = JSON.parse(read('.changeset/config.json'))
  const packages = workspacePackages()
  const names = packages.map((pkg) => pkg.name).sort()

  assert.deepEqual(names, [
    '@hookfish/api',
    '@hookfish/app',
    '@hookfish/example-cloudflare',
    '@hookfish/example-docker',
    '@hookfish/example-node',
    '@hookfish/example-vercel',
    'hookfish',
  ])
  assert.equal(config.baseBranch, 'main')
  assert.equal(config.access, 'public')
  assert.ok(!config.ignore.includes('hookfish'))
  assert.deepEqual(
    [...config.ignore].sort(),
    names.filter((name) => name !== 'hookfish'),
  )
})

test('publish workflow versions on main and publishes hookfish', () => {
  const workflow = read('.github/workflows/publish.yml')
  const rootPackage = JSON.parse(read('package.json'))
  const publishScript = read('scripts/publish-cli.mjs')

  assert.match(workflow, /branches: \[main\]/)
  assert.match(workflow, /changesets\/action@v1/)
  assert.match(workflow, /version: pnpm version-packages/)
  assert.match(workflow, /publish: pnpm release/)
  assert.equal(rootPackage.scripts['version-packages'], 'changeset version && pnpm install --lockfile-only')
  assert.equal(rootPackage.scripts.release, 'node scripts/publish-cli.mjs')
  assert.match(workflow, /id-token: write/)
  assert.match(workflow, /npm@\^11\.5\.1/)
  assert.equal(/^\s+registry-url:/m.test(workflow), false)
  assert.equal(/^\s+NPM_TOKEN:/m.test(workflow), false)
  assert.match(publishScript, /npm', \['publish'/)
  assert.match(publishScript, /npm', \['view'/)
  assert.match(publishScript, /git', \['ls-remote'/)
  assert.match(publishScript, /git', \['tag'/)
  assert.match(publishScript, /packages\/cli/)
  assert.match(publishScript, /New tag: \$\{tag\}/)
})

test('CI and preview workflows skip the Version Packages PR', () => {
  const skip = "github.head_ref != 'changeset-release/main'"

  assert.equal(read('.github/workflows/ci.yml').includes(skip), true)
  assert.equal(read('.github/workflows/deploy-preview.yml').includes(skip), true)
  assert.equal(read('.github/workflows/cleanup-preview.yml').includes(skip), true)
  assert.equal(read('.github/workflows/publish.yml').includes(skip), false)
})
