// Minimal production server for the Node build. `vite build` emits a fetch handler at
// dist/server/server.js plus static assets in dist/client; this wires the two together.
import { fileURLToPath } from 'node:url'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'

const port = Number(process.env.PORT ?? 3000)
const hostname = process.env.HOST ?? '0.0.0.0'

const { default: handler } = await import(
  new URL('./dist/server/server.js', import.meta.url).href
)

const server = serve({
  fetch: (request) => handler.fetch(request),
  hostname,
  middleware: [
    staticMiddleware({ dir: fileURLToPath(new URL('./dist/client/', import.meta.url)) }),
  ],
  port,
})

await server.ready()
console.log(`Listening on http://${hostname}:${port}/`)

const shutdown = () => server.close(true)
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
