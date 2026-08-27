import assert from 'node:assert/strict'
import { getCloudProxy, hydrateCloudProxy, setCloudProxy } from './cloud'

const CLOUD_PROXY_KEY = 'oc:cloud-proxy'
const browserStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: {
      getItem: (key: string) => browserStorage.get(key) ?? null,
      setItem: (key: string, value: string) => browserStorage.set(key, value),
      removeItem: (key: string) => browserStorage.delete(key),
    },
  },
  configurable: true,
})

assert.equal(getCloudProxy(), true)

hydrateCloudProxy()
assert.equal(getCloudProxy(), true)
assert.equal(browserStorage.get(CLOUD_PROXY_KEY), 'true')

setCloudProxy(false)
assert.equal(getCloudProxy(), false)
assert.equal(browserStorage.get(CLOUD_PROXY_KEY), 'false')

browserStorage.clear()
hydrateCloudProxy()
assert.equal(getCloudProxy(), true)

browserStorage.set(CLOUD_PROXY_KEY, 'true')
hydrateCloudProxy()
assert.equal(getCloudProxy(), true)

browserStorage.set(CLOUD_PROXY_KEY, 'false')
hydrateCloudProxy()
assert.equal(getCloudProxy(), false)

console.log('cloud proxy defaults to cloud mode')
