---
'hookfish': minor
---

Serve the app with a strict Content-Security-Policy. Every page gets a fresh nonce, and only scripts carrying it (plus the bundle they load) can run, so injected markup cannot execute script in the page that holds your credentials. MCP App views now load into a sandboxed `/api/mcp-app-frame` document instead of `srcdoc`, so they keep working under the stricter page policy and stay on an opaque origin even if that document is opened directly. The MCP proxy now marks responses `Cache-Control: no-store` and reports an unreachable server as a 502 without echoing the request. OpenAPI requests no longer follow redirects, so custom credential headers are never resent to another host.
