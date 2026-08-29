import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

const pgliteStub = fileURLToPath(
  new URL('../../packages/api/src/db/pglite-stub.ts', import.meta.url),
)

// The Cloudflare plugin resolves the `workers` export condition and builds the SSR
// environment for workerd, so `vite build` emits a Worker that `wrangler deploy` ships.
const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: '@hookfish/api/app',
        replacement: fileURLToPath(
          new URL('../../packages/api/src/app.ts', import.meta.url),
        ),
      },
      {
        find: /packages\/api\/src\/db\/pglite(?:\.ts)?$/,
        replacement: pgliteStub,
      },
    ],
  },
  optimizeDeps: {
    include: ['@tanstack/react-query'],
  },
  ssr: {
    optimizeDeps: {
      include: ['@tanstack/react-query'],
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
