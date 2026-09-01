import assert from 'node:assert/strict'
import { registryEntryMetadata, sourceFromRegistryEntry } from './apis'
import type { ClientApi } from './client-types'
import {
  SOURCE_CACHE_MISSING_MESSAGE,
  SOURCE_REFRESH_COOLDOWN_MESSAGE,
  SOURCE_REFRESH_MIN_INTERVAL_MS,
  SourceCacheMissingError,
  assertCanForceRefresh,
  sourceRefreshWaitMs,
} from './source-refresh'

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

const source: ClientApi = {
  id: 'source-1',
  kind: 'mcp',
  title: 'Widget MCP',
  sourceUrl: 'https://mcp.test?token=secret',
  targets: ['https://mcp.test?token=secret'],
  executables: [
    {
      id: 'tool:read_widget',
      name: 'read_widget',
      badge: 'TOOL',
      accent: 'blue',
      groups: ['Tools'],
      binding: {
        type: 'mcp',
        kind: 'tool',
        method: 'tools/call',
        name: 'read_widget',
      },
      inputSchema: { type: 'object' },
      inputUiSchema: {},
    },
  ],
  groups: [{ name: 'Tools' }],
  labels: {
    source: 'MCP server',
    sourcePlural: 'MCP servers',
    executable: 'RPC',
    executablePlural: 'RPCs',
    target: 'Endpoint',
    execute: 'Call',
    executing: 'Calling…',
    executed: 'Call again',
  },
  adapterData: {
    protocolVersion: '2025-11-25',
    sessionId: 'private-session',
    oauthAuthorized: true,
  },
  credentialsStored: true,
}

const cached = registryEntryMetadata(source)
assert.equal(cached?.kind, 'mcp')
assert.equal(cached?.executables[0]?.name, 'read_widget')
assert.deepEqual(cached?.adapterData, {
  protocolVersion: '2025-11-25',
})
assert.equal('sourceUrl' in (cached ?? {}), false)
assert.equal('targets' in (cached ?? {}), false)
assert.equal('credentialsStored' in (cached ?? {}), false)

const hydrated = sourceFromRegistryEntry(
  { id: source.id, kind: source.kind, sourceUrl: source.sourceUrl },
  { metadata: cached!, updatedAt: '2026-03-01T15:45:00.000Z' },
)
assert.equal(hydrated.title, 'Widget MCP')
assert.equal(hydrated.executables[0]?.name, 'read_widget')
assert.equal(hydrated.updatedAt, '2026-03-01T15:45:00.000Z')
assert.deepEqual(hydrated.targets, [source.sourceUrl])
assert.equal(hydrated.credentialsStored, false)
assert.ok(
  Date.parse(hydrated.updatedAt ?? '') < Date.now() - SOURCE_REFRESH_MIN_INTERVAL_MS,
  'stale registry entries stay readable without revalidation',
)
assert.notEqual(
  hydrated.updatedAt,
  new Date().toISOString(),
  'opening a cached source keeps the registry updatedAt',
)

const now = Date.parse('2026-03-01T15:45:30.000Z')
assert.equal(sourceRefreshWaitMs('2026-03-01T15:45:00.000Z', now), 30_000)
assert.equal(
  sourceRefreshWaitMs('2026-03-01T15:44:00.000Z', now),
  0,
  'refresh is allowed after a minute',
)
assert.equal(SOURCE_REFRESH_MIN_INTERVAL_MS, 60_000)
assert.throws(
  () => assertCanForceRefresh('2026-03-01T15:45:00.000Z', now),
  (error) =>
    error instanceof Error && error.message === SOURCE_REFRESH_COOLDOWN_MESSAGE,
)
assert.doesNotThrow(() => assertCanForceRefresh('2026-03-01T15:44:00.000Z', now))
assert.equal(new SourceCacheMissingError().message, SOURCE_CACHE_MISSING_MESSAGE)

console.log('api cache tests passed')
