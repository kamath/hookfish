import assert from 'node:assert/strict'
import { homepageLaunchHint, localListenPort } from './runtime.ts'

assert.equal(
  localListenPort({ hostname: 'hookfish.dev', port: '443', protocol: 'https:' }),
  undefined,
)
assert.equal(
  localListenPort({ hostname: 'localhost', port: '3000', protocol: 'http:' }),
  '3000',
)
assert.equal(
  localListenPort({ hostname: '127.0.0.1', port: '4001', protocol: 'http:' }),
  '4001',
)
assert.equal(
  localListenPort({ hostname: '[::1]', port: '', protocol: 'http:' }),
  '80',
)
assert.equal(
  localListenPort({ hostname: '::1', port: '', protocol: 'https:' }),
  '443',
)

assert.deepEqual(
  homepageLaunchHint({ hostname: 'example.com', port: '443', protocol: 'https:' }),
  { kind: 'hosted' },
)
assert.deepEqual(
  homepageLaunchHint({ hostname: 'localhost', port: '3000', protocol: 'http:' }),
  { kind: 'local', port: '3000' },
)

console.log('runtime homepage hint distinguishes hosted and loopback')
