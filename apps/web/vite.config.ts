import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ command, mode }) => {
  const isCloudflareBuild = command === 'build' && mode === 'cloudflare'

  return {
    resolve: { tsconfigPaths: true },
    optimizeDeps: {
      include: ['@tanstack/react-query'],
    },
    ssr: {
      ...(!isCloudflareBuild && command === 'build'
        ? { noExternal: true }
        : {}),
      optimizeDeps: {
        include: ['@tanstack/react-query'],
      },
    },
    plugins: [
      devtools(),
      ...(isCloudflareBuild
        ? [cloudflare({ viteEnvironment: { name: 'ssr' } })]
        : []),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
