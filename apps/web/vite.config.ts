import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
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
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
