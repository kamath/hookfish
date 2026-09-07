# hookfish

Run the Hookfish OpenAPI / MCP client locally.

```bash
npm install --global hookfish
hookfish up --port 3000
```

`hookfish` with no command prints help. Open `http://127.0.0.1:3000`. Suggested sources use PGlite under `~/.hookfish/pglite`. Set `POSTGRES_URL` to use Postgres instead.

```bash
hookfish up --host 0.0.0.0 --port 4000
hookfish update
```

If a newer version is on npm, commands print a warning to run `hookfish update`.

Requires Node.js 22.12 or later.

`name` and `version` in `package.json` are the npm identity. Update `bin` if you want the installed command to match a new name. `pnpm pack` and `pnpm publish` run `prepack`, which builds the Node example into `web/` and compiles the CLI so the tarball is self-contained.
