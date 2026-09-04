export const RATE_LIMIT_ROUTES = ['spec', 'execute', 'mcp-proxy'] as const

export type RateLimitRoute = (typeof RATE_LIMIT_ROUTES)[number]

export type RateLimitInput = {
  request: Request
  route: RateLimitRoute
}

export type RateLimit = (input: RateLimitInput) => boolean | Promise<boolean>

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    forwarded ||
    'unknown'
  )
}

export function createMemoryRateLimit(
  limits: Partial<Record<RateLimitRoute, number>> = {},
  windowMs = 60_000,
): RateLimit {
  const max = {
    spec: 20,
    execute: 30,
    'mcp-proxy': 120,
    ...limits,
  }
  const hits = new Map<string, number[]>()

  return ({ request, route }) => {
    const key = `${route}:${clientAddress(request)}`
    const now = Date.now()
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs)
    if (recent.length >= max[route]) {
      hits.set(key, recent)
      return false
    }
    recent.push(now)
    hits.set(key, recent)
    return true
  }
}
