import { access, chmod, cp, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { fileURLToPath } from 'node:url'

const webOutput = fileURLToPath(
  new URL('../../../apps/web/dist/', import.meta.url),
)
const bundledWeb = fileURLToPath(new URL('../web/', import.meta.url))
const serverEntry = fileURLToPath(
  new URL('../../../apps/web/dist/server/server.js', import.meta.url),
)
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url))

try {
  await access(serverEntry, constants.R_OK)
} catch {
  throw new Error(
    'The web app has not been built. Run `pnpm --filter @hookfish/web build` first.',
  )
}

await rm(bundledWeb, { force: true, recursive: true })
await cp(webOutput, bundledWeb, { recursive: true })
await chmod(cliEntry, 0o755)
