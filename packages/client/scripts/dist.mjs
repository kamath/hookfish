import { cp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const dist = new URL('../dist/', import.meta.url)

switch (process.argv[2]) {
  case 'clean':
    await rm(dist, { force: true, recursive: true })
    break
  case 'copy':
    await cp(new URL('../src/styles.css', import.meta.url), new URL('styles.css', dist))
    break
  default:
    throw new Error(`Unknown dist action from ${packageRoot}`)
}
