# Smithery

A fully local [TanStack Start](https://tanstack.com/start) app for browsing, configuring, and running executables from pluggable sources. OpenAPI is the built-in source adapter. Source metadata and keys live in the browser; the server fetches source documents and runs invocations.

This repository is a pnpm/Turborepo workspace:

- `packages/app` contains the reusable client application. Its `App` export accepts an API base URL.
- `apps/web` is the TanStack Start deployment shell that mounts the client application.
- `packages/api` is a mountable Hono API with OpenAPI docs and Hono RPC. TanStack Start forwards `/api/*` into it.
- `packages/cli` builds the `hookfish` npm package and bundles the production web app.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The launcher opens ten curated sources from command mode:
`1`–`5` connect to MCP servers, `6`–`0` read OpenAPI documents. Paste any other URL in the
bar and press `Enter`. Smithery probes the URL to decide whether it is an MCP server or an
OpenAPI document.

## Adding a source type

The frontend consumes the protocol-neutral `ExecutableSource` and `Executable` types in
`packages/app/src/lib/client-types.ts`. Register source discovery/loading in
`packages/app/src/lib/source-adapters.ts`. The launcher infers whether a pasted URL is MCP or
OpenAPI; curated catalog entries still declare a kind. A source parser supplies executable names, badges, accent colors, JSON
Schema inputs, targets, credentials, and UI labels. Curated entries and their number keys live
in `packages/app/src/lib/catalog.ts`; adding a row there also registers its keybinding.

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

