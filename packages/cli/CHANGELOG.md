# hookfish

## 0.13.2
### Patch Changes

- 9b1dbe1: `hookfish up` now picks the next free port when the requested one is taken, creates `~/.hookfish/pglite` if needed, warms the local database before it prints the listen URL, and the local homepage shows that listen port even when the browser hostname is not loopback.

## 0.13.1
### Patch Changes

- 2f52c46: Publish the self-contained CLI. `hookfish up` serves the bundled app locally, and `hookfish update` installs the latest npm release.
