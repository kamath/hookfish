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
`node:crypto`.

The deployed Worker accepts either a `HYPERDRIVE` binding or a `POSTGRES_URL` secret.
`HYPERDRIVE` takes precedence when both are present. Local Vite development still uses
PGlite.

## GitHub deployments

The repository workflows use Neon and Cloudflare together:

- `deploy-preview.yml` creates `preview/pr-<number>` in Neon, migrates it, and deploys
  `smithery-pr-<number>` to Workers. The Neon URL and auth secret are uploaded with the
  Worker version as encrypted secrets. A single pull request comment is updated with the
  latest deployment URL or failure status; failed rebuilds retain a link to the last
  available deployment and include the current workflow logs.
- `cleanup-preview.yml` deletes both resources when the pull request closes or merges.
  It runs from the trusted base branch and never checks out pull request code.
- `deploy-production.yml` migrates Neon's primary branch and updates the stable `smithery`
  Worker on every push to `main`.

The workflows require these GitHub Actions secrets:

- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BETTER_AUTH_SECRET`

Preview deploys run only for branches in this repository. Pull requests from forks do not
receive deployment secrets.

`pnpm --filter @hookfish/example-cloudflare check` runs `wrangler deploy --dry-run`, which
validates the bundle without credentials. That is what CI runs.
