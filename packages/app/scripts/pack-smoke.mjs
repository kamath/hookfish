import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceDirectory = resolve(appDirectory, '../..')
const apiDirectory = resolve(workspaceDirectory, 'packages/api')
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'hookfish-pack-smoke-'))
const packagesDirectory = join(temporaryDirectory, 'packages')
const consumerDirectory = join(temporaryDirectory, 'consumer')

try {
  await mkdir(packagesDirectory)
  await mkdir(consumerDirectory)

  run('pnpm', ['pack', '--pack-destination', packagesDirectory], apiDirectory)
  run('pnpm', ['pack', '--pack-destination', packagesDirectory], appDirectory)

  const tarballs = await readdir(packagesDirectory)
  const apiTarball = tarballs.find((name) => name.includes('hookfish-api'))
  const appTarball = tarballs.find((name) => name.includes('hookfish-app'))
  if (!apiTarball || !appTarball) {
    throw new Error(`Expected app and API tarballs, received: ${tarballs.join(', ')}`)
  }

  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify(
      {
        name: 'hookfish-external-consumer-smoke',
        private: true,
        type: 'module',
        dependencies: {
          '@hookfish/api': `file:${join(packagesDirectory, apiTarball)}`,
          '@hookfish/app': `file:${join(packagesDirectory, appTarball)}`,
          react: '^19.2.0',
          'react-dom': '^19.2.0',
        },
      },
      null,
      2,
    ),
  )
  await writeFile(
    join(temporaryDirectory, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - consumer',
      'overrides:',
      `  '@hookfish/api': file:${join(packagesDirectory, apiTarball)}`,
      '',
    ].join('\n'),
  )
  await writeFile(
    join(consumerDirectory, 'index.html'),
    '<div id="app"></div><script type="module" src="/main.ts"></script>',
  )
  await writeFile(
    join(consumerDirectory, 'main.ts'),
    [
      "import { mountApp } from '@hookfish/app'",
      "import '@hookfish/app/styles.css'",
      '',
      "const element = document.querySelector<HTMLElement>('#app')",
      "if (!element) throw new Error('Missing app mount')",
      "mountApp(element, { apiBaseUrl: '/api' })",
      '',
    ].join('\n'),
  )
  await writeFile(
    join(consumerDirectory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: 'ES2022',
      },
      include: ['main.ts'],
    }),
  )

  run('pnpm', ['install', '--ignore-scripts'], consumerDirectory)
  run(resolve(appDirectory, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], consumerDirectory)
  run(resolve(appDirectory, 'node_modules/.bin/vite'), ['build'], consumerDirectory)
  run(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import('@hookfish/api').then((api) => { if (typeof api.mountApi !== 'function') process.exit(1) })",
    ],
    consumerDirectory,
  )

  const packedApp = JSON.parse(
    await readFile(join(consumerDirectory, 'node_modules/@hookfish/app/package.json'), 'utf8'),
  )
  if (packedApp.private || packedApp.exports?.['.']?.import !== './dist/index.js') {
    throw new Error('Packed app does not expose its distribution build')
  }

  console.log('packed app and API external consumer smoke test passed')
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
