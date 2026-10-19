import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import {
  AppBridge,
  PostMessageTransport,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/app-bridge'
import type { McpAppContext } from '../lib/client-types'
import { traceMcpApp, withMcpConnection } from '../lib/mcp/client'
import {
  appDocument,
  appResourceFrom,
  clampAppHeight,
  hostStyleVariables,
  isOpenableLink,
} from '../lib/mcp/apps'
import { queryErrorMessage } from '../lib/queries'
import { appearanceFor, prefersDarkScheme, themeAtom, type ThemeAppearance } from '../lib/theme'

const HOST_INFO = { name: 'hookfish-inspector', version: '1.0.0' }
const INITIAL_HEIGHT = 360

// Without a separate sandbox origin to host the spec's double-iframe proxy, the view loads from
// srcdoc into a frame sandboxed without allow-same-origin. That gives it an opaque origin: it can
// script itself and post messages, but cannot reach this page's DOM, storage, or cookies. The
// injected CSP limits its network to the origins the resource declares. Popups are not allowed;
// links go through ui/open-link instead.
const SANDBOX = 'allow-scripts allow-forms'

type AppMessage = { id: number; text: string }

function useAppearance(): ThemeAppearance {
  const preference = useAtomValue(themeAtom)
  const [prefersDark, setPrefersDark] = useState(prefersDarkScheme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setPrefersDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return appearanceFor(preference, prefersDark)
}

function hostContext(app: McpAppContext, appearance: ThemeAppearance): McpUiHostContext {
  return {
    ...(app.tool ? { toolInfo: { tool: app.tool as never } } : {}),
    theme: appearance,
    styles: { variables: hostStyleVariables(appearance) as never },
    displayMode: 'inline',
    availableDisplayModes: ['inline'],
    platform: 'web',
    locale: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: HOST_INFO.name,
    deviceCapabilities: {
      touch: window.matchMedia('(pointer: coarse)').matches,
      hover: window.matchMedia('(hover: hover)').matches,
    },
  }
}

function messageText(content: unknown) {
  const blocks = Array.isArray(content) ? content : [content]
  return blocks
    .map((block) => {
      const item = block as { type?: string; text?: string }
      return item?.type === 'text' && typeof item.text === 'string'
        ? item.text
        : JSON.stringify(block)
    })
    .join('\n')
}

export function McpAppView({
  app,
  canCallTool,
}: {
  app: McpAppContext
  canCallTool: (name: string) => boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<AppBridge | null>(null)
  const appearance = useAppearance()
  const appearanceRef = useRef(appearance)
  appearanceRef.current = appearance
  const canCallRef = useRef(canCallTool)
  canCallRef.current = canCallTool
  const [height, setHeight] = useState(INITIAL_HEIGHT)
  const [messages, setMessages] = useState<AppMessage[]>([])
  const resource = useQuery({
    queryKey: ['mcp-app-resource', app.sourceId, app.endpoint, app.resourceUri],
    queryFn: () =>
      withMcpConnection(app.sourceId, app.endpoint, async ({ client }) =>
        appResourceFrom(app.resourceUri, await client.readResource({ uri: app.resourceUri })),
      ),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const frame = frameRef.current
    const target = frame?.contentWindow
    if (!resource.data || !frame || !target) {
      return
    }
    const { sourceId, endpoint } = app
    const bridge = new AppBridge(
      null,
      HOST_INFO,
      {
        openLinks: {},
        serverTools: {},
        serverResources: {},
        logging: {},
        message: { text: {} },
        updateModelContext: { text: {} },
        sandbox: {
          csp: resource.data.csp,
          permissions: resource.data.permissions,
        },
      },
      { hostContext: hostContext(app, appearanceRef.current) },
    )
    bridgeRef.current = bridge
    let closed = false

    bridge.addEventListener('initialized', () => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'ui/notifications/initialized' })
      if (app.tool) {
        void bridge.sendToolInput({ arguments: app.arguments ?? {} })
        void bridge.sendToolResult(app.result as never)
      }
    })
    bridge.addEventListener('sizechange', ({ height: next }) => {
      if (next !== undefined) {
        setHeight(clampAppHeight(next, INITIAL_HEIGHT))
      }
    })
    bridge.addEventListener('loggingmessage', (params) => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'notifications/message', detail: params })
    })
    bridge.addEventListener('requestteardown', () => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'ui/notifications/request-teardown' })
    })
    bridge.oncalltool = async (params) => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'tools/call', detail: params })
      if (!canCallRef.current(params.name)) {
        throw new Error(`Tool "${params.name}" is not available to this app.`)
      }
      return withMcpConnection(sourceId, endpoint, ({ client }) =>
        client.callTool(params) as never,
      )
    }
    bridge.onreadresource = async (params) => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'resources/read', detail: params })
      return withMcpConnection(sourceId, endpoint, ({ client }) => client.readResource(params))
    }
    bridge.onlistresources = async (params) =>
      withMcpConnection(sourceId, endpoint, ({ client }) => client.listResources(params))
    bridge.onlistresourcetemplates = async (params) =>
      withMcpConnection(sourceId, endpoint, ({ client }) => client.listResourceTemplates(params))
    bridge.onopenlink = async ({ url }) => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'ui/open-link', detail: { url } })
      if (!isOpenableLink(url)) {
        return { isError: true }
      }
      window.open(url, '_blank', 'noopener,noreferrer')
      return {}
    }
    bridge.onmessage = async (params) => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'ui/message', detail: params })
      // There is no conversation to append to; show what the view would have said.
      setMessages((current) => [
        ...current,
        { id: current.length, text: messageText(params.content) },
      ])
      return {}
    }
    bridge.onupdatemodelcontext = async (params) => {
      traceMcpApp(sourceId, { direction: 'in', summary: 'ui/update-model-context', detail: params })
      return {}
    }
    bridge.onrequestdisplaymode = async () => ({ mode: 'inline' })

    void (async () => {
      // Listen before the document loads so the view's ui/initialize is not missed.
      await bridge.connect(new PostMessageTransport(target, target))
      if (!closed) {
        frame.srcdoc = appDocument(resource.data.html, resource.data.csp)
      }
    })()

    return () => {
      closed = true
      bridgeRef.current = null
      // The frame is already detached when this runs, so a ui/resource-teardown request would
      // never be answered. Closing drops the listener.
      void bridge.close()
    }
  }, [app, resource.data])

  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge) {
      return
    }
    bridge.setHostContext(hostContext(app, appearance))
  }, [app, appearance])

  if (resource.isPending) {
    return <p className="px-1 py-2 text-sm text-mute">Loading {app.resourceUri}…</p>
  }
  if (resource.isError) {
    return (
      <p className="px-1 py-2 text-sm text-error" role="alert">
        {queryErrorMessage(resource.error, `Could not load ${app.resourceUri}.`)}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <iframe
        key={`${app.resourceUri}:${resource.dataUpdatedAt}`}
        ref={frameRef}
        title={`MCP App ${app.resourceUri}`}
        sandbox={SANDBOX}
        allow={resource.data.allow || undefined}
        referrerPolicy="no-referrer"
        className="block w-full bg-ink/5"
        style={{ height }}
      />
      {messages.length > 0 ? (
        <section className="bg-ink/5 px-3 py-2">
          <h2 className="mb-1 font-mono text-xs text-faint">Messages from the app</h2>
          <ul className="space-y-1">
            {messages.map((message) => (
              <li key={message.id} className="whitespace-pre-wrap text-sm text-ink">
                {message.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
