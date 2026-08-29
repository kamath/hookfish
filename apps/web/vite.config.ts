import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig(({ command, mode }) => {
  const isNodeBuild = command === 'build' && mode === 'node'

  return {
    build: isNodeBuild ? { outDir: 'dist-node' } : undefined,
    resolve: { tsconfigPaths: true },
    optimizeDeps: {
      include: ['@tanstack/react-query'],
    },
    ssr: {
      ...(isNodeBuild ? { noExternal: true } : {}),
      optimizeDeps: {
        include: ['@tanstack/react-query'],
      },
    },
    plugins: [
      devtools(),
      ...(isNodeBuild
        ? []
        : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
