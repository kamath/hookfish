---
'hookfish': patch
---

OAuth MCP servers connect again when Hookfish runs on Node (`npx hookfish up` or local dev). The proxy no longer forwards `content-encoding` for bodies it has already decompressed, which made the browser fail to read compressed OAuth metadata.
