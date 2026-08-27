import assert from 'node:assert/strict'
import {
  ROUTE_VIEW_KEY,
  getRouteView,
  hydrateRouteView,
  isRouteView,
  readRouteView,
  routeInspectValue,
  setRouteView,
} from './route-view.ts'

assert.equal(readRouteView(null), 'invoke')
assert.equal(readRouteView(undefined), 'invoke')
assert.equal(readRouteView(''), 'invoke')
assert.equal(readRouteView('nope'), 'invoke')
assert.equal(readRouteView('invoke'), 'invoke')
assert.equal(readRouteView('inspect'), 'inspect')
assert.equal(isRouteView('invoke'), true)
assert.equal(isRouteView('inspect'), true)
assert.equal(isRouteView('form'), false)

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

assert.equal(getRouteView(), 'invoke')

hydrateRouteView()
assert.equal(getRouteView(), 'invoke')

setRouteView('inspect')
assert.equal(getRouteView(), 'inspect')
assert.equal(browserStorage.get(ROUTE_VIEW_KEY), 'inspect')

hydrateRouteView()
assert.equal(getRouteView(), 'inspect')

browserStorage.set(ROUTE_VIEW_KEY, 'invoke')
hydrateRouteView()
assert.equal(getRouteView(), 'invoke')

assert.deepEqual(
  routeInspectValue({
    name: 'echo',
    summary: 'Echo a value',
    description: 'Returns the input.',
    binding: { type: 'mcp', kind: 'tool', method: 'tools/call', name: 'echo' },
    outputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  }),
  {
    name: 'echo',
    summary: 'Echo a value',
    description: 'Returns the input.',
    binding: { type: 'mcp', kind: 'tool', method: 'tools/call', name: 'echo' },
    outputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  },
)

assert.deepEqual(
  routeInspectValue({
    name: '/pets',
    binding: { type: 'http', method: 'get', path: '/pets' },
  }),
  {
    name: '/pets',
    binding: { type: 'http', method: 'get', path: '/pets' },
  },
)

console.log('route view preference ok')
