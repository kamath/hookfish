# Executable Client

A Cloudflare-ready [TanStack Start](https://tanstack.com/start) app for browsing, configuring, and running executables from pluggable sources. OpenAPI is the built-in source adapter. Source metadata and keys live in the browser; the server fetches source documents and runs invocations.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Try:

`https://petstore3.swagger.io/api/v3/openapi.json`

## Adding a source type

The frontend consumes the protocol-neutral `ExecutableSource` and `Executable` types in
`src/lib/client-types.ts`. Register source discovery/loading in `src/lib/source-adapters.ts`;
the source selector is populated from that registry. A source parser supplies executable
names, badges, accent colors, JSON Schema inputs, targets, credentials, and UI labels.

Register execution behavior with `registerExecutableAdapter()` in
`src/lib/executable-adapters.ts`. An adapter builds a serializable invocation, previews it,
executes it, and can optionally export a code snippet. For example, an MCP adapter can map
tools/resources/prompts to executables, use their names and input schemas directly, execute
JSON-RPC through an MCP server function, and export client/call setup code. The list, form,
keyboard navigation, theming, and result viewer do not need protocol-specific changes.

## MCP inspector

Choose **MCP** on the source screen and enter a Streamable HTTP endpoint. Hookfish uses the
official MCP TypeScript client with automatic protocol negotiation:

- MCP `2026-07-28` discovery, request metadata, MRTR, pagination, and subscriptions
- legacy Streamable HTTP `2025-03-26` through `2025-11-25`, including initialization,
  browser-held session IDs, GET event streams, and session termination
- tools, resources, resource templates, and prompts rendered through the shared executable UI
- request/response and notification traces, capability metadata, bearer tokens, and custom headers
- sampling, elicitation, and roots requests with editable manual JSON responses

The `/api/mcp-proxy` route streams requests and responses without retaining state. MCP
connections, legacy session identifiers, cached listings, and credentials remain in the browser.
Deprecated pre-Streamable-HTTP HTTP+SSE and stdio transports are intentionally not supported.

```bash
pnpm deploy
```
