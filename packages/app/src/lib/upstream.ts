// The browser refused the response, usually because CORS does not allow this origin or a header.
export class CorsError extends Error {}

// The upstream answered the cloud proxy with an HTML page instead of the MCP server, which is
// how bot protection (Cloudflare and similar) turns away requests from a hosted proxy.
export class ProxyBlockedError extends Error {}

export function findCause<T extends Error>(
  error: unknown,
  type: abstract new (...args: never[]) => T,
): T | undefined {
  const seen = new Set<unknown>()
  for (let current = error; current instanceof Error && !seen.has(current); ) {
    if (current instanceof type) {
      return current
    }
    seen.add(current)
    current = current.cause
  }
  return undefined
}

export async function localUpstreamFetch(
  input: string | URL | Request,
  init?: RequestInit,
  upstreamFetch: typeof fetch = fetch,
) {
  try {
    return await upstreamFetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new CorsError('Likely CORS error. Cloud mode may help.', { cause: error })
    }
    throw error
  }
}

export function assertNotProxyBlocked(response: Response, target: string) {
  if (response.status === 403 && /text\/html/i.test(response.headers.get('content-type') ?? '')) {
    throw new ProxyBlockedError(
      `${new URL(target).host} blocked the cloud proxy.`,
    )
  }
}
