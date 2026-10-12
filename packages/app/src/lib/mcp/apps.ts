import {
  RESOURCE_MIME_TYPE,
  buildAllowAttribute,
  getToolUiResourceUri,
  type McpUiResourceCsp,
  type McpUiResourceMeta,
  type McpUiResourcePermissions,
  type McpUiToolVisibility,
} from '@modelcontextprotocol/ext-apps/app-bridge'
import type { Tool } from '@modelcontextprotocol/client'

// MCP Apps (SEP-1865, spec 2026-01-26): tools point at a `ui://` HTML resource that the
// host renders in a sandboxed iframe and talks to over postMessage JSON-RPC.
export const MCP_APPS_EXTENSION_ID = 'io.modelcontextprotocol/ui'

export const MCP_APP_MIME_TYPE = RESOURCE_MIME_TYPE

export const mcpAppsClientExtensions = {
  [MCP_APPS_EXTENSION_ID]: { mimeTypes: [RESOURCE_MIME_TYPE] },
}

export type McpToolApp = {
  resourceUri: string
  visibility?: McpUiToolVisibility[]
}

export function toolApp(tool: Partial<Tool>): McpToolApp | undefined {
  let resourceUri: string | undefined
  try {
    resourceUri = getToolUiResourceUri(tool)
  } catch {
    return undefined
  }
  if (!resourceUri) {
    return undefined
  }
  const ui = tool._meta?.ui
  const visibility =
    ui && typeof ui === 'object' && Array.isArray((ui as { visibility?: unknown }).visibility)
      ? ((ui as { visibility: unknown[] }).visibility.filter(
          (scope) => scope === 'model' || scope === 'app',
        ) as McpUiToolVisibility[])
      : undefined
  return { resourceUri, visibility: visibility?.length ? visibility : undefined }
}

// Visibility defaults to ["model", "app"] when absent.
export function visibleToModel(app: McpToolApp | undefined) {
  return !app?.visibility || app.visibility.includes('model')
}

export function callableFromApp(app: McpToolApp | undefined) {
  return !app?.visibility || app.visibility.includes('app')
}

function sources(domains: string[] | undefined) {
  return (domains ?? []).filter((domain) => /^[\w*.:/-]+$/.test(domain))
}

// The resource's declared origins become the only network the view can reach. Inline script
// and style stay allowed because single-file app bundles depend on them.
export function appContentSecurityPolicy(csp: McpUiResourceCsp | undefined) {
  const resources = sources(csp?.resourceDomains).join(' ')
  const connect = sources(csp?.connectDomains)
  const frames = sources(csp?.frameDomains)
  const bases = sources(csp?.baseUriDomains)
  const withResources = (base: string) => (resources ? `${base} ${resources}` : base)
  return [
    "default-src 'none'",
    withResources("script-src 'self' 'unsafe-inline' blob:"),
    withResources("style-src 'self' 'unsafe-inline'"),
    withResources('img-src data: blob:'),
    withResources('font-src data:'),
    withResources('media-src data: blob:'),
    `connect-src ${connect.length ? connect.join(' ') : "'none'"}`,
    `frame-src ${frames.length ? frames.join(' ') : "'none'"}`,
    `base-uri ${bases.length ? bases.join(' ') : "'self'"}`,
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ')
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// Put the policy ahead of anything the view's own markup can run. A meta policy cannot be
// loosened later: removing the element leaves it enforced, and any second policy only narrows.
export function appDocument(html: string, csp: McpUiResourceCsp | undefined) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(
    appContentSecurityPolicy(csp),
  )}">`
  const head = /<head(\s[^>]*)?>/i.exec(html)
  if (head) {
    const at = head.index + head[0].length
    return `${html.slice(0, at)}${meta}${html.slice(at)}`
  }
  const root = /<html(\s[^>]*)?>/i.exec(html)
  if (root) {
    const at = root.index + root[0].length
    return `${html.slice(0, at)}<head>${meta}</head>${html.slice(at)}`
  }
  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`
}

export type McpAppResource = {
  html: string
  csp?: McpUiResourceCsp
  permissions?: McpUiResourcePermissions
  allow: string
}

function decodeBase64(blob: string) {
  const bytes = Uint8Array.from(atob(blob), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function appResourceFrom(
  resourceUri: string,
  result: { contents?: unknown[] },
): McpAppResource {
  const contents = (result.contents ?? []) as Array<{
    uri?: string
    mimeType?: string
    text?: string
    blob?: string
    _meta?: Record<string, unknown>
  }>
  const content =
    contents.find((item) => item.uri === resourceUri && item.mimeType === RESOURCE_MIME_TYPE) ??
    contents.find((item) => item.mimeType === RESOURCE_MIME_TYPE) ??
    contents[0]
  if (!content) {
    throw new Error(`The server returned no content for ${resourceUri}.`)
  }
  if (content.mimeType && content.mimeType !== RESOURCE_MIME_TYPE) {
    throw new Error(
      `${resourceUri} is ${content.mimeType}, not an MCP App (${RESOURCE_MIME_TYPE}).`,
    )
  }
  const html =
    typeof content.text === 'string'
      ? content.text
      : typeof content.blob === 'string'
        ? decodeBase64(content.blob)
        : undefined
  if (html === undefined) {
    throw new Error(`${resourceUri} has no HTML content.`)
  }
  const meta = (content._meta?.ui ?? {}) as McpUiResourceMeta
  return {
    html,
    csp: meta.csp,
    permissions: meta.permissions,
    allow: buildAllowAttribute(meta.permissions),
  }
}

export function isOpenableLink(url: string) {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:'
  } catch {
    return false
  }
}

export function clampAppHeight(height: number | undefined, fallback: number) {
  if (typeof height !== 'number' || !Number.isFinite(height)) {
    return fallback
  }
  return Math.min(Math.max(Math.ceil(height), 80), 4000)
}

const HOST_PALETTE = {
  light: {
    paper: '#f7f6f3',
    ink: '#1c1b19',
    mute: '#6f6b64',
    faint: '#9a958c',
    signal: '#1d4ed8',
    error: '#8b1e3f',
    warn: '#8a6d1d',
    success: '#2f6f4e',
  },
  dark: {
    paper: '#141311',
    ink: '#eceae4',
    mute: '#a8a39b',
    faint: '#7a756d',
    signal: '#60a5fa',
    error: '#e08a9a',
    warn: '#d4c05c',
    success: '#5fb887',
  },
} as const

// A subset of the spec's standardized style variables, taken from styles.css so a view that
// opts into host styling matches the surrounding inspector.
export function hostStyleVariables(appearance: 'light' | 'dark'): Record<string, string> {
  const color = HOST_PALETTE[appearance]
  const tint = (amount: number) => `color-mix(in srgb, ${color.ink} ${amount}%, ${color.paper})`
  return {
    '--color-background-primary': color.paper,
    '--color-background-secondary': tint(5),
    '--color-background-tertiary': tint(10),
    '--color-background-inverse': color.ink,
    '--color-text-primary': color.ink,
    '--color-text-secondary': color.mute,
    '--color-text-tertiary': color.faint,
    '--color-text-inverse': color.paper,
    '--color-text-info': color.signal,
    '--color-text-danger': color.error,
    '--color-text-warning': color.warn,
    '--color-text-success': color.success,
    '--color-ring-primary': color.signal,
    '--font-sans': '"Atkinson Hyperlegible", system-ui, sans-serif',
    '--font-mono': '"IBM Plex Mono", ui-monospace, monospace',
  }
}
