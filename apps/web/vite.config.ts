import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

// This shell targets Node only. Platform adapters (Cloudflare, Vercel) belong to the
// deployment repository that mounts @hookfish/app and @hookfish/api.
const config = defineConfig(({ command }) => {
  return {
    resolve: { tsconfigPaths: true },
    optimizeDeps: {
      include: ['@tanstack/react-query'],
    },
    ssr: {
      // The CLI ships this build on its own, so the server bundle carries its dependencies.
      ...(command === 'build' ? { noExternal: true } : {}),
      optimizeDeps: {
        include: ['@tanstack/react-query'],
      },
    },
    plugins: [devtools(), tanstackStart(), viteReact()],
  }
})

export default config
