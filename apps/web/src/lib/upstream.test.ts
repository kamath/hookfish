import assert from 'node:assert/strict'
import { localUpstreamFetch } from './upstream'

await assert.rejects(
  () =>
    localUpstreamFetch('https://cross-origin.test', undefined, async () => {
      throw new TypeError('Failed to fetch')
    }),
  /Likely CORS error\. Cloud mode may help\./,
)

await assert.rejects(
  () =>
    localUpstreamFetch('https://slow.test', undefined, async () => {
      throw new DOMException('Timed out', 'TimeoutError')
    }),
  (error) => error instanceof DOMException && !error.message.includes('CORS'),
)

console.log('upstream tests passed')
