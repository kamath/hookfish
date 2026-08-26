import { useState } from 'react'
import type { ProtocolTraceEntry } from '../lib/client-types'

export function ProtocolTrace({ entries }: { entries: ProtocolTraceEntry[] }) {
  const [open, setOpen] = useState(false)
  if (entries.length === 0) {
    return null
  }
  return (
    <section className="mb-3 bg-ink/5 px-3 py-2">
      <button
        type="button"
        className="font-mono text-xs text-mute hover:text-ink"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▾' : '▸'} Protocol trace ({entries.length})
      </button>
      {open ? (
        <ol className="mt-2 space-y-2">
          {entries.map((entry, index) => (
            <li key={`${entry.atMs}:${index}`} className="font-mono text-xs">
              <div className="flex gap-3 text-mute">
                <span className="w-14 shrink-0 text-right">{entry.atMs} ms</span>
                <span className="w-5 shrink-0">{entry.direction === 'out' ? '→' : '←'}</span>
                <span className="text-ink">{entry.summary}</span>
              </div>
              {entry.detail !== undefined ? (
                <pre className="mt-1 overflow-auto whitespace-pre-wrap pl-20 text-[11px] text-faint">
                  {JSON.stringify(entry.detail, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
