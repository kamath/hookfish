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
- Set the build command to `pnpm build:nitro`.
- Do not override the output directory.

The default `pnpm build` uses the Cloudflare adapter. To test the Vercel build
locally, run `pnpm build:nitro`.
