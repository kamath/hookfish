import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REPO_URL,
  USAGE,
  cloneArgs,
  parseCliGhArgs,
  runBranch,
} from '../dist/gh.js'

test('prints usage for help flags and missing args', () => {
  assert.deepEqual(parseCliGhArgs([]), { kind: 'help' })
  assert.deepEqual(parseCliGhArgs(['--help']), { kind: 'help' })
  assert.deepEqual(parseCliGhArgs(['-h']), { kind: 'help' })
  assert.match(USAGE, /pnpm cli:gh <branch>/)
  assert.match(USAGE, /node mode/)
})

test('requires a branch name before options', () => {
  assert.deepEqual(parseCliGhArgs(['--port', '4000']), {
    kind: 'error',
    error: 'a branch name is required before options',
  })
})

test('parses a branch and forwards remaining CLI options', () => {
  assert.deepEqual(parseCliGhArgs(['cursor/demo', '--', '--port', '4000']), {
    kind: 'run',
    branch: 'cursor/demo',
    forwarded: ['--port', '4000'],
  })
})

test('clones kamath/hookfish at the requested branch', () => {
  assert.deepEqual(cloneArgs('main', '/tmp/hookfish'), [
    'clone',
    '--depth',
    '1',
    '--single-branch',
    '--branch',
    'main',
    REPO_URL,
    '/tmp/hookfish',
  ])
})

test('installs, builds apps/web in node mode, then starts the CLI', async () => {
  const commands = []

  await runBranch('main', ['--port', '4000'], {
    createTempDir: async () => '/tmp/hookfish-cli-gh-test',
    removeDir: async () => {},
    run: async (command, args, options = {}) => {
      commands.push({ command, args, cwd: options.cwd })
    },
  })

  assert.deepEqual(commands, [
    {
      command: 'git',
      args: cloneArgs('main', '/tmp/hookfish-cli-gh-test'),
      cwd: undefined,
    },
    {
      command: 'pnpm',
      args: ['install'],
      cwd: '/tmp/hookfish-cli-gh-test',
    },
    {
      command: 'pnpm',
      args: ['--filter', '@hookfish/web', 'build:node'],
      cwd: '/tmp/hookfish-cli-gh-test',
    },
    {
      command: 'pnpm',
      args: ['--filter', 'hookfish', 'build'],
      cwd: '/tmp/hookfish-cli-gh-test',
    },
    {
      command: 'pnpm',
      args: ['--filter', 'hookfish', 'start', '--', '--port', '4000'],
      cwd: '/tmp/hookfish-cli-gh-test',
    },
  ])
})
