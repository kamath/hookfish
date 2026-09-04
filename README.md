# Smithery

A browser-first client for browsing, configuring, and running executables from pluggable
sources. OpenAPI is the built-in source adapter. Connected-source metadata and keys live in
the browser; the server provides suggested sources, fetches source documents, optionally
records successful OpenAPI URLs, and runs proxied invocations.

This repository is a pnpm/Turborepo workspace:

- `packages/app` contains the reusable Vite client application and TanStack Router. Its `mountApp` export accepts an API base URL.
- `examples/` holds four standalone TanStack Start shells that mount the client application:
  `cloudflare`, `vercel`, `node`, and `docker`. See [examples/README.md](examples/README.md).
- `packages/api` is a mountable Hono API with OpenAPI docs and Hono RPC. TanStack Start forwards `/api/*` into it.
- `packages/cli` builds the `hookfish` npm package and bundles `examples/node` as its web app.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The launcher groups database-backed suggestions into one pane
per category. Paste any other URL in the bar and press `Enter`; Smithery probes the URL to
decide whether it is an MCP server or an OpenAPI document.

## Embedding the client

`@hookfish/app` and `@hookfish/api` build as independently consumable packages. A deployment
repository can mount the client without importing this workspace's source:

```ts
import { mountApp } from '@hookfish/app'
import '@hookfish/app/styles.css'

mountApp(document.getElementById('app')!, {
  apiBaseUrl: '/api',
})
```

Mount `@hookfish/api` at the matching path in the deployment platform's request handler:

```ts
import { mountApi } from '@hookfish/api/app'
import { createPostgresDb } from '@hookfish/api/postgres'

export default mountApi('/api', {
  database: createPostgresDb(process.env.POSTGRES_URL!),
})
```

A deployment owns only its HTML/document shell, static asset delivery, and platform
adapter. Neither package requires a platform runtime, and the four shells in `examples/`
are working proofs of that — CI builds all of them on every pull request, so a change that
breaks one runtime fails there rather than at deploy time.

## Adding a source type

The frontend consumes the protocol-neutral `ExecutableSource` and `Executable` types in
`packages/app/src/lib/client-types.ts`. Register source discovery/loading in
`packages/app/src/lib/source-adapters.ts`. The launcher infers whether a pasted URL is MCP or
OpenAPI. A source parser supplies executable names, badges, accent colors, JSON Schema
inputs, targets, credentials, and UI labels. Homepage suggestions come from
`GET /api/registry/feed`.

Register execution behavior with `registerExecutableAdapter()` in
`packages/app/src/lib/executable-adapters.ts`. An adapter builds a serializable invocation,
previews it, executes it, and can optionally export a code snippet. For example, an MCP
adapter can map tools/resources/prompts to executables, use their names and input schemas
directly, execute JSON-RPC through the MCP client and Hono RPC API, and export client/call setup code.
The list, form, keyboard navigation, theming, and result viewer do not need protocol-specific
changes.

## MCP inspector

Pick an MCP server from the launcher or enter a Streamable HTTP endpoint.
Smithery uses the official MCP TypeScript client with automatic protocol negotiation:

- MCP `2026-07-28` discovery, request metadata, MRTR, pagination, and subscriptions
- legacy Streamable HTTP `2025-03-26` through `2025-11-25`, including initialization,
  browser-held session IDs, GET event streams, and session termination
- OAuth 2.1 authorization-code flows with PKCE, dynamic client registration, and
  Client ID Metadata Documents; registrations and tokens stay in browser storage
- tools, resources, resource templates, and prompts rendered through the shared executable UI
- request/response and notification traces plus capability metadata
- sampling, elicitation, and roots requests with editable manual JSON responses

The `/api/mcp-proxy` route streams requests and responses without retaining state. MCP
connections, OAuth credentials, legacy session identifiers, and cached listings remain in
the browser. The UI talks to the `App` component's `apiBaseUrl` through Hono RPC; the web
shell mounts it at `/api`. Auto-generated OpenAPI is served at `/api/openapi.json`.
Deprecated pre-Streamable-HTTP HTTP+SSE and stdio transports are intentionally not supported.

## Registry database

The `registry` table contains `row_id`, `url`, `title`, and `type`; `type` is constrained to
`MCP` or `API`. The `tags` table associates each `registry_row_id` with a string `tag`.
`GET /api/registry/feed` queries `trending_mcp` and `trending_api`, returning a
category-keyed response that the homepage renders as panes. `POST /api/spec`
accepts optional `save: true` to upsert a successfully fetched OpenAPI title and
URL into `registry` as type `API`.
Local Node development and the CLI use PGlite; hosted deployments use Postgres/Neon.

```bash
pnpm db:migrate
pnpm db:studio
```

Production migration commands require `POSTGRES_URL`:

```bash
pnpm db:migrate:prod
pnpm db:studio:prod
```

Build every workspace package:

```bash
pnpm build
```

The resulting CLI package runs the production app with Node—no Wrangler or
Cloudflare runtime is required:

```bash
npm install --global hookfish
hookfish --port 3000
```

Run the workspace build directly during development:

```bash
pnpm cli
```

CLI options are forwarded directly:

```bash
pnpm cli --host 127.0.0.1 --port 4000
```

To inspect the independently publishable npm tarball:

```bash
pnpm --filter hookfish pack
```

## License

MIT. See [LICENSE](./LICENSE).

