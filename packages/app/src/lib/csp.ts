// Content-Security-Policy for the page that hosts the app. Credentials live in this page's
// memory, so the policy's job is to make sure only the app's own scripts ever run here: each
// response gets a fresh nonce, the framework stamps it on the scripts it renders, and
// 'strict-dynamic' lets those scripts load the rest of the bundle. Injected scripts, inline
// handlers, and scripts from anywhere else are refused.
export function createCspNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // 'unsafe-eval' is for Ajv, which the forms use to compile each tool's JSON Schema into a
    // validator with new Function. It does not let injected markup or scripts run.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    // With the cloud proxy off the browser talks to sources directly, and a source can be any
    // MCP or OpenAPI server, including one on localhost.
    "connect-src 'self' https: http: ws: wss:",
    // MCP App views load from the API's frame document; see mcp-app-view.tsx.
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}
