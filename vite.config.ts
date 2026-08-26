import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => {
  const isNitroBuild = mode === 'nitro'

  return {
    resolve: { tsconfigPaths: true },
    optimizeDeps: {
      include: [
        '@tanstack/react-query',
        'use-sync-external-store/shim/with-selector',
      ],
    },
    ssr: {
      optimizeDeps: {
        include: [
          '@tanstack/react-query',
          'use-sync-external-store/shim/with-selector',
        ],
      },
    },
    plugins: [
      devtools(),
      ...(isNitroBuild
        ? []
        : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
      tailwindcss(),
      tanstackStart(),
      ...(isNitroBuild ? [nitro({ preset: 'vercel' })] : []),
      viteReact(),
    ],
  }
})

export default config
