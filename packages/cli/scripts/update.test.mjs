import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  compareVersions,
  isNewerVersion,
  latestPackageUrl,
  resolveUpdateInvocation,
  updateWarning,
} from '../dist/update.js'

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const commandName = Object.keys(packageJson.bin ?? {})[0]

test('compares dotted versions', () => {
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0)
  assert.equal(compareVersions('1.2.4', '1.2.3'), 1)
  assert.equal(compareVersions('1.2.3', '1.2.4'), -1)
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1)
  assert.ok(isNewerVersion('0.14.0', '0.13.0'))
  assert.equal(isNewerVersion('0.13.0', '0.13.0'), false)
  assert.equal(isNewerVersion('0.12.9', '0.13.0'), false)
})

test('builds the update warning and install command', () => {
  assert.equal(
    updateWarning('hookfish', '0.13.0', '0.14.0'),
    'A newer hookfish is available (0.14.0; current 0.13.0). Run `hookfish update`.',
  )
  assert.deepEqual(resolveUpdateInvocation('hookfish', {}), {
    command: 'npm',
    args: ['install', '--global', 'hookfish@latest'],
  })
  assert.deepEqual(resolveUpdateInvocation('hookfish', { npm_config_user_agent: 'pnpm/10.0.0 npm/? node/22' }), {
    command: 'pnpm',
    args: ['add', '--global', 'hookfish@latest'],
  })
  assert.equal(
    latestPackageUrl('hookfish', 'https://registry.npmjs.org'),
    'https://registry.npmjs.org/hookfish/latest',
  )
})

test('warns on up help when npm has a newer version', async () => {
  const registry = await serveRegistry({ version: '99.0.0' })
  try {
    const result = await runCli(['up', '--help'], {
      HOOKFISH_NPM_REGISTRY: registry.url,
      HOOKFISH_SKIP_UPDATE_CHECK: '',
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, new RegExp(`Usage: ${commandName} up \\[options\\]`))
    assert.match(
      result.stderr,
      new RegExp(
        `A newer ${commandName} is available \\(99\\.0\\.0; current ${packageJson.version}\\)\\. Run \`${commandName} update\`\\.`,
      ),
    )
  } finally {
    await registry.close()
  }
})

test('warns on help when npm has a newer version', async () => {
  const registry = await serveRegistry({ version: '99.0.0' })
  try {
    const result = await runCli([], {
      HOOKFISH_NPM_REGISTRY: registry.url,
      HOOKFISH_SKIP_UPDATE_CHECK: '',
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, new RegExp(`Usage: ${commandName} \\[options\\] \\[command\\]`))
    assert.match(
      result.stderr,
      new RegExp(
        `A newer ${commandName} is available \\(99\\.0\\.0; current ${packageJson.version}\\)\\. Run \`${commandName} update\`\\.`,
      ),
    )
  } finally {
    await registry.close()
  }
})

test('does not warn when already on the latest version', async () => {
  const registry = await serveRegistry({ version: packageJson.version })
  try {
    const result = await runCli([], {
      HOOKFISH_NPM_REGISTRY: registry.url,
      HOOKFISH_SKIP_UPDATE_CHECK: '',
    })

    assert.equal(result.status, 0)
    assert.doesNotMatch(result.stderr, /A newer /)
  } finally {
    await registry.close()
  }
})

test('update dry-run prints the install command when outdated', async () => {
  const registry = await serveRegistry({ version: '99.0.0' })
  try {
    const result = await runCli(['update', '--dry-run'], {
      HOOKFISH_NPM_REGISTRY: registry.url,
      HOOKFISH_SKIP_UPDATE_CHECK: '',
      npm_config_user_agent: 'npm/10.0.0 node/22',
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, /Updating hookfish from .* to 99\.0\.0/)
    assert.match(result.stdout, /npm install --global hookfish@latest/)
    assert.doesNotMatch(result.stderr, /A newer /)
  } finally {
    await registry.close()
  }
})

test('update reports already latest', async () => {
  const registry = await serveRegistry({ version: packageJson.version })
  try {
    const result = await runCli(['update'], {
      HOOKFISH_NPM_REGISTRY: registry.url,
      HOOKFISH_SKIP_UPDATE_CHECK: '',
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, new RegExp(`already the latest version \\(${packageJson.version}\\)`))
  } finally {
    await registry.close()
  }
})

test('update fails when npm is unreachable', async () => {
  const result = spawnSync(process.execPath, [cliEntry, 'update', '--dry-run'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOOKFISH_NPM_REGISTRY: 'http://127.0.0.1:1',
      HOOKFISH_SKIP_UPDATE_CHECK: '',
    },
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Could not look up hookfish on npm/)
})

function runCli(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      env: {
        ...process.env,
        ...extraEnv,
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (status) => {
      resolve({ status, stdout, stderr })
    })
  })
}

function serveRegistry(body) {
  return new Promise((resolve, reject) => {
    const server = createHttpServer((request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(body))
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not start mock npm registry'))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((resolveClose) => {
            server.close(() => resolveClose())
          }),
      })
    })
    server.on('error', reject)
  })
}
