import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const cloudflareWorkersStub = fileURLToPath(
  new URL('../../packages/api/src/db/cloudflare-workers-stub.ts', import.meta.url),
)

function copyDrizzleMigrations(): Plugin {
  return {
    name: 'copy-drizzle-migrations',
    apply: 'build',
    async closeBundle() {
      const assetsDir = fileURLToPath(new URL('./dist/server/assets/', import.meta.url))
      await mkdir(assetsDir, { recursive: true })
      await cp(
        fileURLToPath(new URL('../../packages/api/drizzle/', import.meta.url)),
        fileURLToPath(new URL('./dist/server/assets/drizzle/', import.meta.url)),
        { recursive: true, force: true },
      )
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
    ...(command === 'build'
      ? { noExternal: true, external: ['@electric-sql/pglite'] }
      : {}),
    optimizeDeps: {
      include: ['@tanstack/react-query'],
    },
  },
  plugins: [devtools(), copyDrizzleMigrations(), tanstackStart(), viteReact()],
}))

export default config
