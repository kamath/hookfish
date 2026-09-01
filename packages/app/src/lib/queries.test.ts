import assert from 'node:assert/strict'
import {
  SdkErrorCode,
  SdkHttpError,
  UnauthorizedError,
} from '@modelcontextprotocol/client'
import { queryErrorMessage } from './queries.ts'
import { RegistryRefreshTooSoonError } from './source-refresh.ts'

assert.equal(queryErrorMessage(undefined, 'Could not load.'), 'Could not load.')
assert.equal(
  queryErrorMessage(new Error('The spec was empty.'), 'Could not load.'),
  'The spec was empty.',
)

assert.equal(
  queryErrorMessage(
    new SdkHttpError(SdkErrorCode.ClientHttpForbidden, 'Version negotiation failed: the server denied access (HTTP 403)', {
      status: 403,
      statusText: 'Forbidden',
      text: 'Forbidden',
    }),
    'Could not load.',
  ),
  'This server denied access.',
)

assert.equal(
  queryErrorMessage(
    new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint: Invalid session ID', {
      status: 400,
      statusText: 'Bad Request',
      text: 'Invalid session ID',
    }),
    'Could not load.',
  ),
  'The session expired. Try again.',
)

assert.equal(
  queryErrorMessage(
    new Error('Failed to fetch https://mcp.linear.app/mcp'),
    'Could not load.',
  ),
  'Failed to fetch',
)

assert.equal(
  queryErrorMessage(
    new Error('Error POSTing to endpoint: https://mcp.notion.com/mcp'),
    'Could not load.',
  ),
  'Could not load.',
)

assert.equal(
  queryErrorMessage(new UnauthorizedError(), 'Could not load.'),
  'This server needs you to sign in.',
)

assert.equal(
  queryErrorMessage(
    new RegistryRefreshTooSoonError(15_000, '2026-03-01T15:45:00.000Z'),
    'Could not load.',
  ),
  'Wait a minute before refreshing again.',
)

console.log('query error message sanitization ok')
