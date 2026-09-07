import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(join(cliDirectory, 'package.json'), 'utf8'))
const commandName = Object.keys(packageJson.bin ?? {})[0]
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'hookfish-cli-pack-smoke-'))
const packagesDirectory = join(temporaryDirectory, 'packages')
const consumerDirectory = join(temporaryDirectory, 'consumer')
const pgliteDirectory = join(temporaryDirectory, 'pglite')

if (!commandName) {
  throw new Error('packages/cli package.json must define a bin command')
}

try {
  await mkdir(packagesDirectory)
  await mkdir(consumerDirectory)

  run('pnpm', ['pack', '--pack-destination', packagesDirectory], cliDirectory)

  const tarballs = (await readdir(packagesDirectory)).filter((name) => name.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`Expected one CLI tarball, received: ${tarballs.join(', ')}`)
  }

  const tarballPath = join(packagesDirectory, tarballs[0])
  const packedFiles = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

  for (const required of [
    'package/package.json',
    'package/LICENSE',
    'package/README.md',
    'package/dist/index.js',
    'package/web/server/server.js',
  ]) {
    assert.ok(packedFiles.includes(required), `tarball missing ${required}`)
  }

  assert.ok(
    packedFiles.some((file) => file.startsWith('package/web/client/')),
    'tarball missing packed web client assets',
  )
  assert.equal(
    packedFiles.some((file) => file.startsWith('package/src/')),
    false,
    'tarball must not include TypeScript sources',
  )
  assert.equal(
    packedFiles.some((file) => file.startsWith('package/scripts/')),
    false,
    'tarball must not include build scripts',
  )

  const packedManifest = JSON.parse(
    execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], { encoding: 'utf8' }),
  )
  assert.notEqual(packedManifest.private, true)
  assert.equal(packedManifest.publishConfig?.access, 'public')
  assert.equal(packedManifest.bin?.[commandName], 'dist/index.js')
  assert.equal(
    Object.values(packedManifest.dependencies ?? {}).some((value) => String(value).startsWith('workspace:')),
    false,
    'published CLI must not depend on workspace protocol packages',
  )

  await writeJson(join(consumerDirectory, 'package.json'), {
    name: 'hookfish-cli-pack-smoke',
    private: true,
    type: 'module',
    dependencies: {
      [packageJson.name]: `file:${tarballPath}`,
    },
  })

  run('pnpm', ['install', '--ignore-scripts'], consumerDirectory)

  const installedCli = join(
    consumerDirectory,
    'node_modules',
    ...packageJson.name.split('/'),
    'dist',
    'index.js',
  )
  const help = execFileSync(process.execPath, [installedCli], {
    encoding: 'utf8',
  })
  assert.match(help, new RegExp(`Usage: ${commandName} \\[options\\] \\[command\\]`))
  assert.match(help, /Commands:/)
  assert.match(help, /up +Start the local server/)

  const upHelp = execFileSync(process.execPath, [installedCli, 'up', '--help'], {
    encoding: 'utf8',
  })
  assert.match(upHelp, new RegExp(`Usage: ${commandName} up \\[options\\]`))
  assert.match(upHelp, /--port <number>/)
  assert.match(upHelp, /--host <host>/)

  const port = await freePort()
  const child = spawn(
    process.execPath,
    [installedCli, 'up', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: consumerDirectory,
      env: {
        ...process.env,
        PGLITE_DATA_DIR: pgliteDirectory,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  const output = { stdout: '', stderr: '' }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    output.stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    output.stderr += chunk
  })

  try {
    await waitForOutput(child, output, /listening on /i, 30_000)

    const homepage = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(homepage.status, 200)
    assert.match(await homepage.text(), /Hookfish/i)

    const openApi = await fetch(`http://127.0.0.1:${port}/api/openapi.json`)
    assert.equal(openApi.status, 200)
    const spec = await openApi.json()
    assert.equal(typeof spec, 'object')
    assert.ok(spec.openapi || spec.swagger)
  } finally {
    child.kill('SIGTERM')
    await waitForExit(child, 10_000)
  }

  console.log(`packed ${packageJson.name}@${packageJson.version} install-and-serve smoke test passed`)
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, CI: '1' },
    stdio: 'inherit',
  })
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a free port'))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePort(port)
      })
    })
    server.on('error', reject)
  })
}

function waitForOutput(child, output, pattern, timeoutMs) {
  return new Promise((resolveWait, reject) => {
    const deadline = setTimeout(() => {
      cleanup()
      reject(
        new Error(
          `Timed out waiting for ${pattern}. stdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
        ),
      )
    }, timeoutMs)

    const onData = () => {
      if (pattern.test(`${output.stdout}\n${output.stderr}`)) {
        cleanup()
        resolveWait()
      }
    }

    const onExit = (code, signal) => {
      cleanup()
      reject(
        new Error(
          `CLI exited before ready (code ${code}, signal ${signal}). stdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
        ),
      )
    }

    function cleanup() {
      clearTimeout(deadline)
      child.stdout.off('data', onData)
      child.stderr.off('data', onData)
      child.off('exit', onExit)
    }

    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('exit', onExit)
    onData()
  })
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveWait) => {
    if (child.exitCode !== null || child.signalCode) {
      resolveWait()
      return
    }

    const deadline = setTimeout(() => {
      child.kill('SIGKILL')
      resolveWait()
    }, timeoutMs)

    child.once('exit', () => {
      clearTimeout(deadline)
      resolveWait()
    })
  })
}
