# hookfish

## 0.14.0
### Minor Changes

- 7562e55: Serve the app with a strict Content-Security-Policy. Every page gets a fresh nonce, and only scripts carrying it (plus the bundle they load) can run, so injected markup cannot execute script in the page that holds your credentials. MCP App views now load into a sandboxed `/api/mcp-app-frame` document instead of `srcdoc`, so they keep working under the stricter page policy and stay on an opaque origin even if that document is opened directly. The MCP proxy now marks responses `Cache-Control: no-store` and reports an unreachable server as a 502 without echoing the request. OpenAPI requests no longer follow redirects, so custom credential headers are never resent to another host.
- d4f2d36: Search the web for remote MCP servers from the home page: type a name instead of a URL and choose **Search the web** (or press `Enter` when no suggestion matches). Results show how each server authenticates, and picking one fills in its URL and any headers it needs for you to complete before connecting. Results come from Exa and need `EXA_API_KEY`. Suggested sources are now built in, so Hookfish no longer needs PGlite or Postgres.
- 53d1d0d: Render MCP Apps. Tools that declare a `ui://` resource show their view in a sandboxed iframe after a call, and the view can call tools, read resources, open links, and send messages through the inspector. App-only tools are grouped separately.
- 5ca6d65: Keep credentials in memory only. API keys, bearer tokens, custom headers, and MCP OAuth access and refresh tokens are no longer written to localStorage, so reloading or opening a new tab starts signed out. Only the short-lived OAuth handshake (state, PKCE verifier, client registration) is kept in the tab's sessionStorage so the redirect back from the authorization server can finish. Credentials saved by earlier versions are wiped from localStorage on load.
- 39221e1: Add optional custom request headers when opening a source. Fill in name and value rows under **Headers** in the launcher, or paste `.env` lines, a JSON object, or `Name: value` lines to fill them all at once (Enter on a filled value adds another row, Cmd+Enter connects); they are held in memory for the session, sent with every MCP or OpenAPI request to that source, forwarded by the cloud proxy, and removed when you clear auth.

### Patch Changes

- e86d31e: Update the default MCP servers to Gmail (Arcade), Linear, Google Calendar (Arcade), Notion, and Slack (Arcade), alternating Arcade-hosted and first-party servers.
- fa5f3f2: Hovering the tools list no longer pulls you out of an open tool or resource; click a row to switch to it.
- a989102: The protocol traces toggle and the back button now live in the top navbar, and the operation filter is simply labelled **Search**.
- 77da366: When a server's bot protection blocks the cloud proxy (as mcp.exa.ai does), the error now offers a **Use browser mode** button that retries from your browser, and on the hosted site suggests running locally with `npx hookfish up`.
- 05c36f3: OAuth MCP servers connect again when Hookfish runs on Node (`npx hookfish up` or local dev). The proxy no longer forwards `content-encoding` for bodies it has already decompressed, which made the browser fail to read compressed OAuth metadata.
- 38718d4: Resizing the window across the keyboard-shortcut breakpoint no longer crashes the home page with "Cannot read properties of undefined (reading 'length')".
- dd647ac: Shared links now unfurl with a title, description, and preview image.

## 0.13.3
### Patch Changes

- 8823108: Exit immediately on Ctrl+C while `hookfish up` is running

## 0.13.2
### Patch Changes

- 9b1dbe1: `hookfish up` now picks the next free port when the requested one is taken, creates `~/.hookfish/pglite` if needed, warms the local database before it prints the listen URL, and the local homepage shows that listen port even when the browser hostname is not loopback.

## 0.13.1
### Patch Changes

- 2f52c46: Publish the self-contained CLI. `hookfish up` serves the bundled app locally, and `hookfish update` installs the latest npm release.
