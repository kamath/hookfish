export async function localUpstreamFetch(
  input: string | URL | Request,
  init?: RequestInit,
  upstreamFetch: typeof fetch = fetch,
) {
  try {
    return await upstreamFetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Likely CORS error. Cloud mode may help.', { cause: error })
    }
    throw error
  }
}
