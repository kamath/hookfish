import type { ReactNode } from 'react'
import type { ExecutableSource } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import { useMcpTrace } from '../lib/mcp/trace'
import { Kbd } from './hints'

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

function McpChromeLine({ parts }: { parts: ReactNode[] }) {
  return (
    <span className="text-mute">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <span className="text-faint"> · </span> : null}
          {part}
        </span>
      ))}
    </span>
  )
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
  const extraCapabilities = capabilities.filter(
    (capability) =>
      capability !== 'tools' && capability !== 'prompts' && capability !== 'resources',
  )

  return (
    <section className="bg-ink/5 px-3 py-2 text-xs md:px-4">
      <McpChromeLine
        parts={[
          ...mcpChromeFacts(data).map((fact) => (
            <span key={fact.text} title={fact.title}>
              {fact.text}
            </span>
          )),
          ...(['prompts', 'resources', 'tools'] as const).map((capability) => {
            const enabled = capabilitySet.has(capability)
            return (
              <span
                key={capability}
                aria-disabled={!enabled}
                className={enabled ? undefined : 'text-faint'}
              >
                {`${capability} ${enabled ? counts[capability] : 'disabled'}`}
              </span>
            )
          }),
          <button
            key="traces"
            type="button"
            data-oc-trace-toggle
            data-oc-command-focus="true"
            aria-pressed={traceOpen}
            aria-label={traceOpen ? 'Close protocol traces' : 'Open protocol traces'}
            className={`inline-flex items-center gap-1.5 font-mono outline-none ${
              traceOpen ? 'text-ink' : 'text-mute hover:text-ink'
            }`}
            onClick={onToggleTrace}
          >
            {`traces ${entries.length}`}
            <Kbd hotkey="T" />
          </button>,
          ...extraCapabilities.map((capability) => (
            <span key={capability}>{capability}</span>
          )),
        ]}
      />
    </section>
  )
}
