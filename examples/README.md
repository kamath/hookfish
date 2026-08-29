# Deployment examples

Each directory is a complete, standalone TanStack Start shell that mounts
[`@hookfish/app`](../packages/app) in the browser and
[`@hookfish/api`](../packages/api) at `/api`. They are deliberately duplicated rather than
sharing a base package, so any one of them can be copied out of this repository and run on
its own — change the two `workspace:*` dependencies to published versions and it works.

| Example | Runtime | Deploy with |
| --- | --- | --- |
| [`cloudflare`](./cloudflare) | Workers (workerd) | `pnpm --filter @hookfish/example-cloudflare deploy` |
| [`vercel`](./vercel) | Vercel Node functions | `vercel deploy` |
| [`node`](./node) | Node 22+ | `pnpm --filter @hookfish/example-node start` |
| [`docker`](./docker) | Node 22+ container | `docker build -f examples/docker/Dockerfile .` |

The shells are identical apart from the platform adapter. `src/routes/__root.tsx` renders the
document and mounts the client; `src/routes/api.$.ts` forwards `/api/*` into the Hono app;
`src/server.ts` exports the `fetch` handler each platform wraps. What differs is
`vite.config.ts` and the platform's own config file.

CI builds all four on every pull request, so a dependency that stops working on one runtime
fails the build rather than being discovered at deploy time.

`packages/cli` ships the `node` example as the web app inside the published `hookfish`
package.
