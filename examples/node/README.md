# Node

The plainest deployment: `vite build` with no platform adapter, served by a ~25-line
[`serve.mjs`](./serve.mjs).

```bash
pnpm install
pnpm --filter @hookfish/example-node build
pnpm --filter @hookfish/example-node start    # PORT=3000 HOST=0.0.0.0
```

Set `POSTGRES_URL=postgres://...` to pass Postgres to `mountApi`. When it is
unset, this example uses PGlite.

`ssr.noExternal: true` inlines dependencies into `dist/server/server.js`, so the build output
plus `srvx` is everything the process needs — the `dist/` directory can be copied to a host
that never runs `pnpm install`.

`packages/cli` builds this example and copies its `dist/` into the published `hookfish`
package, which is why the CLI can run the app straight from npm with no build step.
