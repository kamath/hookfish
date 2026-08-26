# OpenAPI Client

A Cloudflare- and Vercel-ready [TanStack Start](https://tanstack.com/start) app. Specs and keys live in the browser. The server only fetches OpenAPI documents and executes requests. Paste an OpenAPI URL to get a typed client built with [react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form).

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Try:

`https://petstore3.swagger.io/api/v3/openapi.json`

## Deploy

Cloudflare Workers:

```bash
pnpm deploy
```

Vercel:

- Import the repository and select **Other** as the framework preset.
- Use `pnpm build` (Vercel's `VERCEL=1` environment variable selects the Nitro adapter automatically).
- Do not override the output directory.

To test the Vercel build locally, run `pnpm build:vercel`. Cloudflare builds
remain available through `pnpm build:cloudflare`.
