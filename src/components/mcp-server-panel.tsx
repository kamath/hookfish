import type { ExecutableSource } from '../lib/client-types'
import { asRecord } from '../lib/build-request'

export function McpServerPanel({ source }: { source: ExecutableSource }) {
  if (source.kind !== 'mcp') {
    return null
  }
  const data = asRecord(source.adapterData)
  const capabilities = Object.keys(asRecord(data.capabilities))
  const serverInfo = asRecord(data.serverInfo)
  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-ink/5 px-3 py-2 text-xs md:px-4">
      <span className="font-mono text-ink">
        MCP {typeof data.protocolVersion === 'string' ? data.protocolVersion : 'unknown'}
      </span>
      <span className="text-mute">{data.era === 'modern' ? 'modern' : 'legacy SHTTP'}</span>
      {typeof serverInfo.version === 'string' ? (
        <span className="text-faint">server {serverInfo.version}</span>
      ) : null}
      {capabilities.map((capability) => (
        <span key={capability} className="bg-paper px-1.5 py-0.5 font-mono text-mute">
          {capability}
        </span>
      ))}
      {typeof data.sessionId === 'string' ? (
        <span className="ml-auto font-mono text-faint" title={data.sessionId}>
          session {data.sessionId.slice(0, 8)}…
        </span>
      ) : (
        <span className="ml-auto text-faint">sessionless</span>
      )}
    </section>
  )
}
