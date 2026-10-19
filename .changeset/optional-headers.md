---
'hookfish': minor
---

Add optional custom request headers when opening a source. Fill in name and value rows under **Headers** in the launcher, or paste `.env` lines, a JSON object, or `Name: value` lines to fill them all at once (Enter steps through the fields, Cmd+Enter opens the source); they are stored in the browser, sent with every MCP or OpenAPI request to that source, forwarded by the cloud proxy, and removed when you clear auth.
