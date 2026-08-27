# Executable Client

A fully local [TanStack Start](https://tanstack.com/start) app for browsing, configuring, and running executables from pluggable sources. OpenAPI is the built-in source adapter. Source metadata and keys live in the browser; the server fetches source documents and runs invocations.

This repository is a pnpm/Turborepo workspace:

- `apps/web` contains the TanStack Start app.
- `packages/cli` builds the `hookfish` npm package and bundles the production web app.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Try:

`https://petstore3.swagger.io/api/v3/openapi.json`

## Adding a source type

The frontend consumes the protocol-neutral `ExecutableSource` and `Executable` types in
`apps/web/src/lib/client-types.ts`. Register source discovery/loading in
`apps/web/src/lib/source-adapters.ts`;
the source selector is populated from that registry. A source parser supplies executable
names, badges, accent colors, JSON Schema inputs, targets, credentials, and UI labels.

Register execution behavior with `registerExecutableAdapter()` in
`apps/web/src/lib/executable-adapters.ts`. An adapter builds a serializable invocation,
previews it, executes it, and can optionally export a code snippet. For example, an MCP
adapter can map tools/resources/prompts to executables, use their names and input schemas
directly, execute JSON-RPC through an MCP server function, and export client/call setup code.
The list, form, keyboard navigation, theming, and result viewer do not need protocol-specific
changes.

## MCP inspector

Choose **MCP** on the source screen and enter a Streamable HTTP endpoint. Hookfish uses the
official MCP TypeScript client with automatic protocol negotiation:

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
the browser.
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
pnpm build
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
