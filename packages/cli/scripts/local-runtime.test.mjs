import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const { attachLocalRuntime, injectLocalRuntimeHtml, localRuntimeResponse, localRuntimeScript } =
  await import(fileURLToPath(new URL('../dist/local-runtime.js', import.meta.url)))

test('injectLocalRuntimeHtml inserts the runtime script into head', () => {
  const html = injectLocalRuntimeHtml('<html><head><title>Hookfish</title></head></html>', 4001)
  assert.match(html, /<head><script>window\.__HOOKFISH_RUNTIME__=/)
  assert.match(html, /"local":true/)
  assert.match(html, /"port":4001/)
})

test('localRuntimeResponse reports the listen port', async () => {
  const response = localRuntimeResponse(3200)
  assert.deepEqual(await response.json(), { local: true, port: 3200 })
})

test('attachLocalRuntime rewrites HTML and leaves JSON alone', async () => {
  const html = await attachLocalRuntime(
    new Response('<html><head></head></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
    3001,
  )
  assert.equal((await html.text()).includes(localRuntimeScript(3001)), true)

  const json = await attachLocalRuntime(
    new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }),
    3001,
  )
  assert.equal(await json.text(), '{"ok":true}')
})
