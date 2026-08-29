import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

// No platform adapter: TanStack Start's default build targets Node, which is what the
// container runs. `ssr.noExternal` inlines dependencies so the runtime stage needs no install.
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
