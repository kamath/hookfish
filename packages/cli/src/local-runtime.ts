export type LocalRuntime = {
  local: true
  port: number
}

export function localRuntimeScript(port: number): string {
  return `<script>window.__HOOKFISH_RUNTIME__=${JSON.stringify({ local: true, port } satisfies LocalRuntime)};</script>`
}

export function injectLocalRuntimeHtml(html: string, port: number): string {
  const script = localRuntimeScript(port)
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

  const html = injectLocalRuntimeHtml(await response.text(), port)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
