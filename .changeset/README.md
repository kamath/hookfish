# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to version and publish the `hookfish` CLI.

Add a changeset when a CLI-facing change should ship to npm:

```bash
pnpm changeset
```

Select only `hookfish`. Other workspace packages are ignored so they are not versioned or published by this flow.

Merges to `main` open or update a **Version Packages** PR. Merging that PR publishes `hookfish` to npm.
