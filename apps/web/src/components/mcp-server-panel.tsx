import type { ExecutableSource } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import { useMcpTrace } from '../lib/mcp/trace'
import { Kbd } from './hints'

export function mcpTransportLabel(era: unknown, sessionId: unknown) {
  const protocol = era === 'modern' ? 'modern' : 'legacy SHTTP'
  const session = typeof sessionId === 'string' ? 'stateful' : 'stateless'
  return `${protocol}/${session}`
}

export function McpServerPanel({
  source,
  traceOpen,
  onToggleTrace,
}: {
  source: ExecutableSource
  traceOpen?: boolean
  onToggleTrace?: () => void
}) {
  if (source.kind !== 'mcp') {
    return null
  }
  return (
    <McpServerChrome
      source={source}
      traceOpen={traceOpen}
      onToggleTrace={onToggleTrace}
    />
  )
}

function McpServerChrome({
  source,
  traceOpen,
  onToggleTrace,
}: {
  source: ExecutableSource
  traceOpen?: boolean
  onToggleTrace?: () => void
}) {
  const data = asRecord(source.adapterData)
  const capabilities = Object.keys(asRecord(data.capabilities))
  const capabilitySet = new Set(capabilities)
  const serverInfo = asRecord(data.serverInfo)
  const entries = useMcpTrace(source.id)
  const counts = source.executables.reduce(
    (current, executable) => {
      if (executable.binding.type !== 'mcp') {
        return current
      }
      if (executable.binding.kind === 'tool') {
        current.tools += 1
      } else if (executable.binding.kind === 'prompt') {
        current.prompts += 1
      } else if (
        executable.binding.kind === 'resource' ||
        executable.binding.kind === 'resource-template'
      ) {
        current.resources += 1
      }
      return current
    },
    { tools: 0, prompts: 0, resources: 0 },
  )
  return (
    <section className="bg-ink/5 px-3 py-2 text-xs md:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-ink">
          MCP {typeof data.protocolVersion === 'string' ? data.protocolVersion : 'unknown'}
        </span>
        <span
          className="text-mute"
          title={typeof data.sessionId === 'string' ? data.sessionId : undefined}
        >
          {mcpTransportLabel(data.era, data.sessionId)}
        </span>
        {data.oauthAuthorized === true ? (
          <span className="bg-paper px-1.5 py-0.5 font-mono text-mute">OAuth</span>
        ) : null}
        {typeof serverInfo.version === 'string' ? (
          <span className="text-faint">server {serverInfo.version}</span>
        ) : null}
        {(['prompts', 'resources', 'tools'] as const).map((capability) => {
          const enabled = capabilitySet.has(capability)
          return (
            <span
              key={capability}
              aria-disabled={!enabled}
              className={`px-1.5 py-0.5 font-mono ${
                enabled ? 'bg-paper text-mute' : 'bg-ink/5 text-faint'
              }`}
            >
              {capability} {enabled ? counts[capability] : 'disabled'}
            </span>
          )
        })}
        <button
          type="button"
          data-oc-trace-toggle
          data-oc-command-focus="true"
          aria-pressed={traceOpen}
          aria-label={traceOpen ? 'Close protocol traces' : 'Open protocol traces'}
          className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 font-mono ${
            traceOpen ? 'bg-paper text-ink' : 'bg-paper text-mute hover:text-ink'
          }`}
          onClick={onToggleTrace}
        >
          traces {entries.length}
          <Kbd hotkey="T" />
        </button>
        {capabilities
          .filter(
            (capability) =>
              capability !== 'tools' &&
              capability !== 'prompts' &&
              capability !== 'resources',
          )
          .map((capability) => (
            <span key={capability} className="bg-paper px-1.5 py-0.5 font-mono text-mute">
              {capability}
            </span>
          ))}
      </div>
    </section>
  )
}
