---
'hookfish': minor
---

Keep credentials in memory only. API keys, bearer tokens, custom headers, and MCP OAuth access and refresh tokens are no longer written to localStorage, so reloading or opening a new tab starts signed out. Only the short-lived OAuth handshake (state, PKCE verifier, client registration) is kept in the tab's sessionStorage so the redirect back from the authorization server can finish. Credentials saved by earlier versions are wiped from localStorage on load.
