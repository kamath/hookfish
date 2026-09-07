# @hookfish/app

Embeddable Hookfish browser client.

```ts
import { mountApp } from '@hookfish/app'
import '@hookfish/app/styles.css'

const unmount = mountApp(document.getElementById('app')!, {
  apiBaseUrl: '/api',
})
```

`mountApp` owns its React root, TanStack Router, query client, and browser state. Call the
returned function to unmount it. Use `basepath` when the client is hosted below the origin
root.
