import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { fetchUpstreamSpec } from './upstream'

export const fetchSpec = createServerFn({
  method: 'POST',
  strict: { output: false },
})
  .validator(z.object({ url: z.string().trim().min(1) }))
  .handler(async ({ data }): Promise<unknown> => fetchUpstreamSpec(data.url))
