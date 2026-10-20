export type LocalRuntime = {
  local: true
  port: number
}

// The page's Content-Security-Policy only runs scripts carrying its nonce, so the injected
// script reuses the one the server issued for this response.
export function cspNonceFrom(policy: string | null | undefined): string | undefined {
  return policy ? /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(policy)?.[1] : undefined
}

export function localRuntimeScript(port: number, nonce?: string): string {
  const attributes = nonce ? ` nonce="${nonce}"` : ''
  return `<script${attributes}>window.__HOOKFISH_RUNTIME__=${JSON.stringify({ local: true, port } satisfies LocalRuntime)};</script>`
}

export function injectLocalRuntimeHtml(html: string, port: number, nonce?: string): string {
  const script = localRuntimeScript(port, nonce)
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (open) => `${open}${script}`)
  }
  return `${script}${html}`
}

export function localRuntimeResponse(port: number): Response {
  return Response.json({ local: true, port })
}

export async function attachLocalRuntime(response: Response, port: number): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return response
  }

  const html = injectLocalRuntimeHtml(
    await response.text(),
    port,
    cspNonceFrom(response.headers.get('content-security-policy')),
  )
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
