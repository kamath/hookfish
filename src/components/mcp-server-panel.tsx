import { useState } from 'react'
import type { ExecutableSource } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import { inputClass, primaryButtonClass } from '../lib/ui'

export function McpServerPanel({
  source,
  onSaveCredentials,
  pending,
}: {
  source: ExecutableSource
  onSaveCredentials: (credentials: Record<string, unknown>) => Promise<void>
  pending: boolean
}) {
  const [editing, setEditing] = useState(false)
  if (source.kind !== 'mcp') {
    return null
  }
  const data = asRecord(source.adapterData)
  const capabilities = Object.keys(asRecord(data.capabilities))
  const serverInfo = asRecord(data.serverInfo)
  return (
    <section className="bg-ink/5 px-3 py-2 text-xs md:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-ink">
          MCP {typeof data.protocolVersion === 'string' ? data.protocolVersion : 'unknown'}
        </span>
        <span className="text-mute">
          {data.era === 'modern' ? 'modern' : 'legacy SHTTP'}
        </span>
        {typeof serverInfo.version === 'string' ? (
          <span className="text-faint">server {serverInfo.version}</span>
        ) : null}
        {capabilities.map((capability) => (
          <span key={capability} className="bg-paper px-1.5 py-0.5 font-mono text-mute">
            {capability}
          </span>
        ))}
        <button
          type="button"
          className="ml-auto text-mute hover:text-ink"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? 'Close credentials' : 'Edit credentials'}
        </button>
        {typeof data.sessionId === 'string' ? (
          <span className="font-mono text-faint" title={data.sessionId}>
            session {data.sessionId.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-faint">sessionless</span>
        )}
      </div>
      {editing ? (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            void onSaveCredentials({
              bearerToken: String(values.get('bearerToken') ?? ''),
              headers: String(values.get('headers') ?? ''),
            }).then(() => setEditing(false))
          }}
        >
          <label className="min-w-48 flex-1">
            <span className="text-faint">Bearer token</span>
            <input
              name="bearerToken"
              type="password"
              autoComplete="off"
              className={`${inputClass} mt-1`}
              placeholder={source.credentialsStored ? 'Leave blank to keep current' : 'Token'}
            />
          </label>
          <label className="min-w-64 flex-[2]">
            <span className="text-faint">Additional headers (JSON)</span>
            <input
              name="headers"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} mt-1 font-mono`}
              placeholder={
                source.credentialsStored ? 'Leave blank to keep current' : '{"X-API-Key":"…"}'
              }
            />
          </label>
          <button type="submit" className={primaryButtonClass} disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
