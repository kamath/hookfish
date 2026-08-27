import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { executeUpstreamRequest } from './upstream'

export const executeRequest = createServerFn({
  method: 'POST',
})
  .validator(
    z.object({
      transport: z.literal('http'),
      method: z.string().trim().min(1),
      url: z.string().trim().min(1),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
    }),
  )
  .handler(async ({ data }) =>
    executeUpstreamRequest({
      ...data,
      headers: data.headers ?? {},
    }),
  )
