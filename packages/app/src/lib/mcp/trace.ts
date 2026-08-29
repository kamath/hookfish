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

function messageId(detail: ProtocolTraceEntry['detail']): string | undefined {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
    return undefined
  }
  if (!('id' in detail) || detail.id === undefined || detail.id === null) {
    return undefined
  }
  return String(detail.id)
}

export function groupProtocolTrace(entries: ProtocolTraceEntry[]): ProtocolRpc[] {
  const groups: ProtocolRpc[] = []
  const byId = new Map<string, ProtocolRpc>()

  for (const [index, entry] of entries.entries()) {
    const id = messageId(entry.detail)

    if (entry.direction === 'out') {
      const group: ProtocolRpc = {
        id: id ? `rpc:${id}:${index}` : `${entry.atMs}:${index}`,
        atMs: entry.atMs,
        direction: entry.direction,
        kind: entry.kind,
        summary: entry.summary,
        frames: [entry],
      }
      groups.push(group)
      if (id) {
        byId.set(id, group)
      }
      continue
    }

    const matched = id ? byId.get(id) : undefined
    if (matched) {
      matched.frames.push(entry)
      continue
    }

    if (entry.kind === 'http') {
      const open = groups.find(
        (group) =>
          group.direction === 'out' &&
          !group.frames.some((frame) => frame.kind === 'http'),
      )
      if (open) {
        open.frames.push(entry)
        continue
      }
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

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function compact(value: Record<string, unknown>) {
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined && item !== null && item !== '',
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function rpcFrameView(frame: ProtocolTraceEntry): {
  label: string
  value?: unknown
} {
  const object = asObject(frame.detail)

  if (frame.kind === 'http') {
    return {
      label: frame.summary,
      value: object ? compact(object) : frame.detail,
    }
  }

  if (!object) {
    return { label: frame.summary, value: frame.detail }
  }

  if (object.error !== undefined) {
    return { label: 'error', value: object.error }
  }

  if (object.result !== undefined) {
    return { label: 'result', value: object.result }
  }

  const notify =
    frame.kind === 'notification' ||
    (typeof object.method === 'string' && object.id === undefined)
  const fields = compact({
    id: object.id,
    params: object.params,
  })
  return fields
    ? {
        label: notify ? 'notify' : 'request',
        value: fields,
      }
    : { label: notify ? 'notify' : 'request' }
}

export function rpcAccent(summary: string): string {
  const method = summary.toLowerCase()
  if (method.includes('tool')) {
    return 'var(--accent-mcp-tool)'
  }
  if (method.includes('resource')) {
    return 'var(--accent-mcp-resource)'
  }
  if (method.includes('prompt')) {
    return 'var(--accent-mcp-prompt)'
  }
  if (
    method.includes('initialize') ||
    method.startsWith('server/') ||
    method === 'ping'
  ) {
    return 'var(--signal)'
  }
  if (method.startsWith('notifications/') || method === 'notification') {
    return 'var(--accent-mcp-template)'
  }
  return 'var(--ink)'
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
