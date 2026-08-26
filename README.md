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

```bash
pnpm deploy
```
