import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

// No platform adapter: TanStack Start's default build targets Node. `packages/cli` ships
// this output, so the SSR bundle inlines its dependencies and runs from a copied directory.
const config = defineConfig(({ command, mode }) => {
  // Server-only secrets live in the repo-root .env. Vite only reads .env from this folder
  // and never copies unprefixed values onto process.env, so do both here.
  const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
  for (const [name, value] of Object.entries(loadEnv(mode, repoRoot, 'EXA_'))) {
    process.env[name] ??= value
  }
  return {
    resolve: {
      tsconfigPaths: true,
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
    plugins: [devtools(), tanstackStart(), viteReact()],
  }
})

export default config
