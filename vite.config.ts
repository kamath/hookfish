import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => {
  const isVercelBuild = mode === 'vercel' || process.env.VERCEL === '1'

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
      ...(isVercelBuild
        ? []
        : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
      tailwindcss(),
      tanstackStart(),
      ...(isVercelBuild ? [nitro({ preset: 'vercel' })] : []),
      viteReact(),
    ],
  }
})

export default config
