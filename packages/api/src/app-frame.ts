// MCP App views are third-party HTML. Loading them from srcdoc would make them inherit the
// host page's Content-Security-Policy, which only lets nonce-tagged scripts run, so every
// inline app bundle would break. Instead the view frame loads this page: a real document with
// its own policy. It waits for the parent to post the view's HTML and writes it in place, so
// the policy the host injects into that HTML is the one that applies.
export const MCP_APP_FRAME_READY = 'hookfish:mcp-app-frame-ready'
export const MCP_APP_FRAME_HTML = 'hookfish:mcp-app-html'

// `sandbox` keeps the page on an opaque origin even when it is opened or framed outside the
// app, so HTML posted to it can never run as this origin. frame-ancestors stops other sites
// from framing it to feed it HTML.
export const MCP_APP_FRAME_CSP = "sandbox allow-scripts allow-forms; frame-ancestors 'self'"

const MCP_APP_FRAME_HTML_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
addEventListener('message', function load(event) {
  if (event.source !== parent || !event.data || event.data.type !== ${JSON.stringify(MCP_APP_FRAME_HTML)} || typeof event.data.html !== 'string') return
  removeEventListener('message', load)
  document.open()
  document.write(event.data.html)
  document.close()
})
parent.postMessage({ type: ${JSON.stringify(MCP_APP_FRAME_READY)} }, '*')
</script></body></html>`

export function mcpAppFrameResponse() {
  return new Response(MCP_APP_FRAME_HTML_DOCUMENT, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': MCP_APP_FRAME_CSP,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
