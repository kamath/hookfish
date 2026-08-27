import { mkdir, writeFile } from 'node:fs/promises'

const deployDirectory = new URL('../.wrangler/deploy/', import.meta.url)
const deployConfig = new URL('config.json', deployDirectory)

await mkdir(deployDirectory, { recursive: true })
await writeFile(
  deployConfig,
  `${JSON.stringify({
    configPath: '../../dist/server/wrangler.json',
    auxiliaryWorkers: [],
  })}\n`,
)
