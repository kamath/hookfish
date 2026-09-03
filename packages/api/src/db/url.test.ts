import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  isDrizzleProd,
  isPostgresUrl,
  resolveDatabaseTarget,
  resolvePgliteDataDir,
} from './url'

assert.equal(isPostgresUrl('postgres://localhost/hookfish'), true)
assert.equal(isPostgresUrl('postgresql://localhost/hookfish'), true)
assert.equal(isPostgresUrl('http://localhost'), false)
assert.equal(isPostgresUrl(undefined), false)

assert.equal(isDrizzleProd({ npm_lifecycle_event: 'db:migrate:prod' }), true)
assert.equal(isDrizzleProd({ npm_lifecycle_event: 'db:studio:prod' }), true)
assert.equal(isDrizzleProd({ DRIZZLE_PROD: '1' }), true)
assert.equal(isDrizzleProd({ npm_lifecycle_event: 'db:migrate' }), false)

assert.deepEqual(
  resolveDatabaseTarget({
    HYPERDRIVE: { connectionString: 'postgres://hyperdrive/hookfish' },
    POSTGRES_URL: 'postgres://local/hookfish',
  }),
  { kind: 'postgres', url: 'postgres://hyperdrive/hookfish' },
)

assert.deepEqual(resolveDatabaseTarget({ POSTGRES_URL: 'postgres://local/hookfish' }), {
  kind: 'postgres',
  url: 'postgres://local/hookfish',
})

assert.throws(
  () => resolveDatabaseTarget({ npm_lifecycle_event: 'db:migrate:prod' }),
  /POSTGRES_URL is required/,
)

assert.throws(
  () => resolveDatabaseTarget({}, { cloudflare: true }),
  /Hyperdrive binding or POSTGRES_URL/,
)

const apiModuleUrl = 'file:///workspace/packages/api/src/db/url.ts'
assert.equal(
  resolvePgliteDataDir({}, apiModuleUrl),
  fileURLToPathFromHref('file:///workspace/packages/api/.data'),
)
assert.equal(resolvePgliteDataDir({ PGLITE_DATA_DIR: '/tmp/pglite' }, apiModuleUrl), '/tmp/pglite')
assert.equal(
  resolvePgliteDataDir({}, 'file:///app/server/assets/chunk.js'),
  join(homedir(), '.hookfish', 'pglite'),
)

assert.deepEqual(resolveDatabaseTarget({}, { moduleUrl: apiModuleUrl }), {
  kind: 'pglite',
  dataDir: fileURLToPathFromHref('file:///workspace/packages/api/.data'),
})

assert.deepEqual(
  resolveDatabaseTarget({}, { cloudflare: true, localDev: true, moduleUrl: apiModuleUrl }),
  {
    kind: 'pglite',
    dataDir: fileURLToPathFromHref('file:///workspace/packages/api/.data'),
  },
)

function fileURLToPathFromHref(href: string) {
  return new URL(href).pathname
}

console.log('db url tests passed')
