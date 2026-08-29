import assert from 'node:assert/strict'
import { neitherSourceError, probeSource } from './source-kind.ts'

{
  const calls: string[] = []
  const source = await probeSource({
    readOpenApi: async () => {
      calls.push('read-openapi')
      return { openapi: '3.1.0' }
    },
    loadOpenApi: () => {
      calls.push('load-openapi')
      return 'openapi'
    },
    loadMcp: async () => {
      calls.push('load-mcp')
      return 'mcp'
    },
    isMcpAuthorization: () => false,
  })
  assert.equal(source, 'openapi')
  assert.deepEqual(calls, ['read-openapi', 'load-openapi'])
}

{
  const calls: string[] = []
  const source = await probeSource({
    readOpenApi: async () => {
      calls.push('read-openapi')
      return undefined
    },
    loadOpenApi: () => 'openapi',
    loadMcp: async () => {
      calls.push('load-mcp')
      return 'mcp'
    },
    isMcpAuthorization: () => false,
  })
  assert.equal(source, 'mcp')
  assert.deepEqual(calls, ['read-openapi', 'load-mcp'])
}

{
  const parserError = new Error('No operations were found in this spec.')
  let mcpCalled = false
  await assert.rejects(
    probeSource({
      readOpenApi: async () => ({ openapi: '3.1.0' }),
      loadOpenApi: () => {
        throw parserError
      },
      loadMcp: async () => {
        mcpCalled = true
        return 'mcp'
      },
      isMcpAuthorization: () => false,
    }),
    (error) => error === parserError,
  )
  assert.equal(mcpCalled, false, 'an identified OpenAPI document is not retried as MCP')
}

{
  const authorization = new Error('authorization required')
  await assert.rejects(
    probeSource({
      readOpenApi: async () => undefined,
      loadOpenApi: () => 'openapi',
      loadMcp: async () => {
        throw authorization
      },
      isMcpAuthorization: (error) => error === authorization,
    }),
    (error) => error === authorization,
  )
}

await assert.rejects(
  probeSource({
    readOpenApi: async () => {
      throw new Error('Could not fetch the spec (404).')
    },
    loadOpenApi: () => 'openapi',
    loadMcp: async () => {
      throw new Error('bare unauthorized response')
    },
    isMcpAuthorization: () => false,
  }),
  /not an OpenAPI document or an MCP server/,
)

assert.equal(
  neitherSourceError([new Error('Could not fetch the spec (404).')]).message,
  'This URL is not an OpenAPI document or an MCP server.',
)
assert.equal(
  neitherSourceError([
    new Error('Likely CORS error. Cloud mode may help.'),
    new Error('Error POSTing to endpoint'),
  ]).message,
  'Likely CORS error. Cloud mode may help.',
)
assert.equal(
  neitherSourceError([
    new Error('Could not fetch the spec (401).'),
    new Error('bare unauthorized response'),
  ]).message,
  'This URL requires authentication, so its source type could not be detected.',
)

console.log('source kind inference ok')
