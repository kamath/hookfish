// Vercel serves dist/client from the filesystem first (see vercel.json `outputDirectory`)
// and rewrites everything else here. The Node runtime invokes this default export with
// Node's (req, res); getRequestListener adapts that to the Web `fetch` handler Start emits.
import { getRequestListener } from '@hono/node-server'

import handler from '../dist/server/server.js'

export default getRequestListener((request) => handler.fetch(request))
