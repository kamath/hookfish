import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { cloudflare } from '@cloudflare/vite-plugin'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ command }) => {
  const cloudflareBuild = process.env.CLOUDFLARE_BUILD === '1'

  return {
    ...(cloudflareBuild ? { build: { outDir: '../../dist', emptyOutDir: true } } : {}),
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
    plugins: [
      devtools(),
      ...(cloudflareBuild
        ? [
            cloudflare({
              configPath: '../../wrangler.jsonc',
              viteEnvironment: { name: 'ssr' },
            }),
          ]
        : []),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
