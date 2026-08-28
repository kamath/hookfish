import assert from 'node:assert/strict'
import type { Executable } from './client-types.ts'
import {
  authPlaceholder,
  executableSnippetName,
  snippetBaseName,
  toFetch,
  toHttpExportSnippet,
  withAuthPlaceholders,
  withZodExport,
} from './export-snippet.ts'

assert.equal(authPlaceholder('api_key'), 'INSERT_API_KEY')
assert.equal(authPlaceholder('bearerAuth'), 'INSERT_BEARER_AUTH')
assert.equal(authPlaceholder('x-api-key'), 'INSERT_X_API_KEY')
assert.equal(authPlaceholder('basic.username'), 'INSERT_BASIC_USERNAME')
assert.equal(authPlaceholder('APIKey'), 'INSERT_API_KEY')

assert.deepEqual(
  withAuthPlaceholders({ api_key: 'secret' }, ['api_key', 'token']),
  { api_key: 'secret', token: 'INSERT_TOKEN' },
)
assert.deepEqual(withAuthPlaceholders({}, ['api_key']), {
  api_key: 'INSERT_API_KEY',
})
assert.deepEqual(withAuthPlaceholders({ api_key: '  ' }, ['api_key']), {
  api_key: 'INSERT_API_KEY',
})

assert.equal(
  toFetch({
    transport: 'http',
    method: 'GET',
    url: 'https://example.com/pets',
    headers: { api_key: 'INSERT_API_KEY' },
  }),
  `fetch("https://example.com/pets", {
  headers: {
    api_key: "INSERT_API_KEY",
  },
})`,
)

assert.equal(
  toFetch({
    transport: 'http',
    method: 'GET',
    url: 'https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available',
    headers: {},
  }),
  'fetch("https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available")',
)

assert.equal(
  toFetch({
    transport: 'http',
    method: 'GET',
    url: 'https://example.com/pets',
    headers: { Accept: 'application/json' },
  }),
  `fetch("https://example.com/pets", {
  headers: {
    Accept: "application/json",
  },
})`,
)

const fetchPost = toFetch({
  transport: 'http',
  method: 'POST',
  url: 'https://petstore3.swagger.io/api/v3/pet',
  headers: {
    'Content-Type': 'application/json',
    api_key: 'special-key',
  },
  body: JSON.stringify({
    name: 'doggie',
    photoUrls: ['https://example.com/a'],
    status: 'available',
  }),
})
assert.equal(
  fetchPost,
  `fetch("https://petstore3.swagger.io/api/v3/pet", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    api_key: "special-key",
  },
  body: JSON.stringify({
    "name": "doggie",
    "photoUrls": [
      "https://example.com/a"
    ],
    "status": "available"
  }),
})`,
)

assert.equal(snippetBaseName('getPetById'), 'getPetById')
assert.equal(snippetBaseName('find-pets-by-status'), 'findPetsByStatus')
assert.equal(snippetBaseName('get:/pets/{petId}'), 'getPetsPetId')
assert.equal(snippetBaseName('123weather'), 'operation123weather')
assert.equal(snippetBaseName(''), 'operation')

const addPet: Executable = {
  id: 'addPet',
  name: '/pet',
  badge: 'POST',
  accent: 'var(--accent-http-post)',
  groups: [],
  binding: { type: 'http', method: 'post', path: '/pet' },
  inputSchema: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          photoUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['name'],
      },
    },
    required: ['body'],
  },
  inputUiSchema: {},
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
    },
    required: ['id', 'name'],
  },
}

assert.equal(executableSnippetName(addPet), 'addPet')

const zodHttp = toHttpExportSnippet(
  {
    transport: 'http',
    method: 'POST',
    url: 'https://example.com/pet',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'doggie', photoUrls: ['https://example.com/a'] }),
  },
  addPet,
  { body: { name: 'doggie', photoUrls: ['https://example.com/a'] } },
)

assert.match(zodHttp, /import \{ z \} from "zod"/)
assert.match(zodHttp, /const addPetInputSchema = z\.object/)
assert.match(zodHttp, /const addPetOutputSchema = z\.object/)
assert.match(zodHttp, /const input = addPetInputSchema\.parse/)
assert.match(
  zodHttp,
  /const result = addPetOutputSchema\.parse\(await \(await fetch\("https:\/\/example.com\/pet"/,
)
assert.match(zodHttp, /\.json\(\)\)/)

const getItems: Executable = {
  ...addPet,
  id: 'get:/items',
  name: '/items',
  badge: 'GET',
  binding: { type: 'http', method: 'get', path: '/items' },
  inputSchema: { type: 'object', properties: {} },
  outputSchema: undefined,
}

const zodGet = toHttpExportSnippet(
  {
    transport: 'http',
    method: 'GET',
    url: 'https://example.com/items',
  },
  getItems,
  {},
)
assert.match(zodGet, /const getItemsInputSchema = /)
assert.doesNotMatch(zodGet, /OutputSchema/)
assert.match(zodGet, /const result = await fetch\("https:\/\/example.com\/items"\)/)

const refSchema = withZodExport({
  name: 'lookupPet',
  inputSchema: {
    type: 'object',
    properties: {
      pet: { $ref: '#/$defs/Pet' },
    },
    $defs: {
      Pet: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
  },
  expression: 'doTheThing(input)',
})
assert.match(refSchema, /"pet": z\.object\(\{ "id": z\.number\(\)\.int\(\) \}\)\.optional\(\)/)
assert.match(refSchema, /const result = await doTheThing\(input\)/)

const weather = withZodExport({
  name: 'get-weather',
  inputSchema: {
    type: 'object',
    properties: { location: { type: 'string' } },
    required: ['location'],
  },
  outputSchema: {
    type: 'object',
    properties: { temperature: { type: 'number' } },
    required: ['temperature'],
  },
  imports: [
    "import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'",
  ],
  setup: 'await client.connect(transport)',
  input: { location: 'NYC' },
  expression: `client.callTool({
  name: "get-weather",
  arguments: input,
})`,
})
assert.ok(weather.startsWith('import { z } from "zod"\nimport { Client, StreamableHTTPClientTransport }'))
assert.match(weather, /const getWeatherInputSchema = /)
assert.match(weather, /const getWeatherOutputSchema = /)
assert.match(
  weather,
  /const result = getWeatherOutputSchema\.parse\(await client\.callTool\(\{/,
)

console.log('export-snippet ok')
