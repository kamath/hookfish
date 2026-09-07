---
'hookfish': patch
---

`hookfish up` now picks the next free port when the requested one is taken, creates `~/.hookfish/pglite` if needed, warms the local database before it prints the listen URL, and the local homepage shows that listen port even when the browser hostname is not loopback.
