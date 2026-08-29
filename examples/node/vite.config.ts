import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const cloudflareWorkersStub = fileURLToPath(
  new URL('../../packages/api/src/db/cloudflare-workers-stub.ts', import.meta.url),
)

function copyPgliteAssets(): Plugin {
  return {
    name: 'copy-pglite-assets',
    apply: 'build',
    async closeBundle() {
      const require = createRequire(
        fileURLToPath(new URL('../../packages/api/package.json', import.meta.url)),
      )
      const pgliteDir = dirname(require.resolve('@electric-sql/pglite'))
      const assetsDir = fileURLToPath(new URL('./dist/server/assets/', import.meta.url))
      await mkdir(assetsDir, { recursive: true })

      for (const name of ['pglite.data', 'pglite.wasm', 'initdb.wasm']) {
        const from = join(pgliteDir, name)
        if (existsSync(from)) {
          await cp(from, join(assetsDir, name), { force: true })
        }
      }

      const drizzleFrom = fileURLToPath(
        new URL('../../packages/api/drizzle/', import.meta.url),
      )
      await cp(drizzleFrom, join(assetsDir, 'drizzle'), {
        recursive: true,
        force: true,
      })
    },
  }
}

// No platform adapter: TanStack Start's default build targets Node. `packages/cli` ships
// this output, so the SSR bundle inlines its dependencies and runs from a copied directory.
const config = defineConfig(({ command }) => ({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'cloudflare:workers': cloudflareWorkersStub,
    },
  },
  optimizeDeps: {
    include: ['@tanstack/react-query'],
  },
  ssr: {
    ...(command === 'build' ? { noExternal: true } : {}),
    optimizeDeps: {
      include: ['@tanstack/react-query'],
    },
  },
  plugins: [devtools(), copyPgliteAssets(), tanstackStart(), viteReact()],
}))

export default config
