import type { ExecutableSource } from '../lib/client-types'
import { asRecord } from '../lib/build-request'

export function mcpTransportLabel(era: unknown, sessionId: unknown) {
  const protocol = era === 'modern' ? 'modern' : 'legacy SHTTP'
  const session = typeof sessionId === 'string' ? 'stateful' : 'stateless'
  return `${protocol}/${session}`
}

export type McpChromeFact = {
  text: string
  title?: string
}

export function mcpChromeFacts(data: Record<string, unknown>): McpChromeFact[] {
  const facts: McpChromeFact[] = [
    {
      text: `MCP ${typeof data.protocolVersion === 'string' ? data.protocolVersion : 'unknown'}`,
    },
    {
      text: mcpTransportLabel(data.era, data.sessionId),
      title: typeof data.sessionId === 'string' ? data.sessionId : undefined,
    },
  ]
  if (data.oauthAuthorized === true) {
    facts.push({ text: 'OAuth' })
  }
  const serverInfo = asRecord(data.serverInfo)
  if (typeof serverInfo.version === 'string') {
    facts.push({ text: `server ${serverInfo.version}` })
  }
  return facts
}

export function McpServerPanel({ source }: { source: ExecutableSource }) {
  if (source.kind !== 'mcp') {
    return null
  }
  return <McpServerChrome source={source} />
}

function McpServerChrome({ source }: { source: ExecutableSource }) {
  const data = asRecord(source.adapterData)
  const capabilities = Object.keys(asRecord(data.capabilities))
  const capabilitySet = new Set(capabilities)
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
  const facts = mcpChromeFacts(data)

  return (
    <section className="bg-ink/5 px-3 py-2 text-xs md:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-mute">
          {facts.map((fact, index) => (
            <span key={`${fact.text}:${index}`}>
              {index > 0 ? <span className="text-faint"> · </span> : null}
              <span title={fact.title}>{fact.text}</span>
            </span>
          ))}
        </span>
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
