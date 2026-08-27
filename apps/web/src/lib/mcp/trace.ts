import { useEffect, useState } from 'react'
import type { ProtocolTraceEntry } from '../client-types'
import { getMcpTrace, subscribeMcpTrace } from './client'

export type ProtocolRpc = {
  id: string
  atMs: number
  direction: ProtocolTraceEntry['direction']
  kind: ProtocolTraceEntry['kind']
  summary: string
  frames: ProtocolTraceEntry[]
}

export function groupProtocolTrace(entries: ProtocolTraceEntry[]): ProtocolRpc[] {
  const groups: ProtocolRpc[] = []
  for (const [index, entry] of entries.entries()) {
    const current = groups.at(-1)
    if (entry.direction === 'in' && current?.direction === 'out') {
      current.frames.push(entry)
      continue
    }
    groups.push({
      id: `${entry.atMs}:${index}`,
      atMs: entry.atMs,
      direction: entry.direction,
      kind: entry.kind,
      summary: entry.summary,
      frames: [entry],
    })
  }
  return groups
}

export function useMcpTrace(sourceId: string) {
  const [entries, setEntries] = useState<ProtocolTraceEntry[]>(() => getMcpTrace(sourceId))
  useEffect(() => {
    const sync = () => setEntries(getMcpTrace(sourceId))
    sync()
    return subscribeMcpTrace(sourceId, sync)
  }, [sourceId])
  return entries
}
