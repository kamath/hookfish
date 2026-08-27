import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { parse as parseYaml } from 'yaml'
import { isHttpUrl } from './build-request'

const MAX_SPEC_BYTES = 2_000_000

async function loadSpec(specUrl: string): Promise<unknown> {
  if (!isHttpUrl(specUrl)) {
    throw new Error('Enter an http or https OpenAPI URL.')
  }

  const response = await fetch(specUrl, {
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, text/plain, */*',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Could not fetch the spec (${response.status}).`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_SPEC_BYTES) {
    throw new Error('The spec is larger than 2 MB.')
  }

  const text = new TextDecoder().decode(buffer).trim()
  if (!text) {
    throw new Error('The spec was empty.')
  }

  try {
    if (text.startsWith('{') || text.startsWith('[')) {
      return JSON.parse(text)
    }
    return parseYaml(text)
  } catch {
    throw new Error('The response was not valid JSON or YAML.')
  }
}

export const fetchSpec = createServerFn({
  method: 'POST',
  strict: { output: false },
})
  .validator(z.object({ url: z.string().trim().min(1) }))
  .handler(async ({ data }): Promise<unknown> => loadSpec(data.url))
