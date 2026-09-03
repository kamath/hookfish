# Docker

The [`node`](../node) example in a container. Build from the repository root so the pnpm
workspace and lockfile are in context:

```bash
docker build -f examples/docker/Dockerfile -t smithery-example .
docker run --rm -p 3000:3000 -e POSTGRES_URL smithery-example
```

[`Dockerfile`](./Dockerfile) is two stages. The build stage installs the workspace and runs
`turbo run build --filter=@hookfish/example-docker`, then `pnpm deploy --legacy` resolves a
production-only `node_modules` (just `srvx` — `ssr.noExternal` put everything else inside the
server bundle). The runtime stage copies that plus `dist/` onto a clean `node:22-alpine` and
drops to the `node` user. The result is ~90 MB.

`PORT` and `HOST` are read at startup, both already set in the image.
`POSTGRES_URL` is required for database-backed homepage suggestions.
