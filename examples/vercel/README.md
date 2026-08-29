# Vercel

Static client from `dist/client`, SSR and API through a single Node function.

```bash
pnpm install
pnpm --filter @hookfish/example-vercel build
vercel deploy
```

TanStack Start has no Vercel preset in v1, so the wiring is explicit and small:

- [`vercel.json`](./vercel.json) sets `outputDirectory` to `dist/client` and rewrites
  everything the filesystem does not serve to `/api`.
- [`api/index.mjs`](./api/index.mjs) is the function. Vercel's Node runtime invokes it with
  Node's `(req, res)`; `getRequestListener` from `@hono/node-server` adapts that to the Web
  `fetch` handler `vite build` emits.

`ssr.noExternal: true` makes `dist/server/server.js` self-contained, so Vercel's dependency
tracing only has to follow `@hono/node-server`.

`pnpm --filter @hookfish/example-vercel test` starts a real `node:http` server around
`api/index.mjs` and asserts the SSR shell and `/api/openapi.json` both answer, so the adapter
is verified without a deploy.
