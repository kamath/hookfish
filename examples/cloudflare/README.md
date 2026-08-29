# Cloudflare Workers

Runs the whole app — SSR shell and API — inside a single Worker, with the client bundle
served from Workers static assets.

```bash
pnpm install
pnpm --filter @hookfish/example-cloudflare dev      # http://localhost:3000
pnpm --filter @hookfish/example-cloudflare deploy
```

`@cloudflare/vite-plugin` drives this. It resolves the `workers` export condition and builds
the SSR environment for workerd, so `vite build` emits a deployable Worker at
`dist/server/index.js` plus a resolved `dist/server/wrangler.json`. `deploy` points Wrangler
at that generated config rather than at `wrangler.jsonc`, which describes the *source* entry
for local development.

`wrangler.jsonc` sets `nodejs_compat`, which the SSR bundle needs for `node:async_hooks` and
`node:crypto`. Rename `smithery-example` before deploying to your own account.

`pnpm --filter @hookfish/example-cloudflare check` runs `wrangler deploy --dry-run`, which
validates the bundle without credentials. That is what CI runs.
