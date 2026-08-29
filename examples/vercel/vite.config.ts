import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

// No platform adapter: TanStack Start's default Node build is what Vercel's Node runtime
// runs. `ssr.noExternal` inlines dependencies so api/index.mjs only has to bridge protocols.
const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
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
}))

export default config
