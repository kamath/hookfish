import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ProtocolTraceEntry } from '../lib/client-types'
import { consumePointerIntent, usePaneActions, useStepKeys } from '../lib/keys'
import { activate, getPane } from '../lib/mode'
import {
  groupProtocolTrace,
  rpcAccent,
  rpcFrameView,
  useMcpTrace,
  type ProtocolRpc,
} from '../lib/mcp/trace'
import { Kbd, KeyHints } from './hints'

function moveSelection(
  groups: ProtocolRpc[],
  selectedId: string | undefined,
  delta: number,
) {
  if (groups.length === 0) {
    return { id: undefined, followLatest: true }
  }
  const current = groups.findIndex((group) => group.id === selectedId)
  const start = current === -1 ? groups.length - 1 : current
  const next = Math.min(Math.max(start + delta, 0), groups.length - 1)
  return {
    id: groups[next]?.id,
    followLatest: next === groups.length - 1,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function scalarText(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) {
    return 'null'
  }
  return JSON.stringify(value)
}

function itemLead(value: unknown): { text: string; rest?: unknown } | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  for (const key of ['name', 'uri', 'method', 'uriTemplate'] as const) {
    const text = value[key]
    if (typeof text === 'string' && text.length > 0) {
      const rest = { ...value }
      delete rest[key]
      return {
        text,
        rest: Object.keys(rest).length > 0 ? rest : undefined,
      }
    }
  }
  return undefined
}

function nestClass(depth: number) {
  return depth > 0 ? 'mt-1 space-y-1 bg-ink/5 px-3 py-1.5' : 'space-y-1'
}

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-faint">[]</span>
    }
    return (
      <ol className={nestClass(depth)}>
        {value.map((item, index) => {
          const lead = itemLead(item)
          return (
            <li key={index} className="font-mono text-xs leading-relaxed">
              <div className="flex gap-3">
                <span className="w-6 shrink-0 text-right tabular-nums text-faint">{index}</span>
                {lead ? (
                  <span className="min-w-0 break-words text-ink">{lead.text}</span>
                ) : item !== null && typeof item === 'object' ? (
                  <span className="text-faint">
                    {Array.isArray(item) ? `[${item.length}]` : `{${Object.keys(item).length}}`}
                  </span>
                ) : (
                  <span className="min-w-0 break-words text-ink">{scalarText(item)}</span>
                )}
              </div>
              {lead?.rest !== undefined ? (
                <div className="pl-9">
                  <JsonTree value={lead.rest} depth={depth + 1} />
                </div>
              ) : !lead && item !== null && typeof item === 'object' ? (
                <div className="pl-9">
                  <JsonTree value={item} depth={depth + 1} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    )
  }

  if (!isRecord(value)) {
    return <span className="break-words text-ink">{scalarText(value)}</span>
  }

  const entries = Object.entries(value).filter(([key]) => key !== 'jsonrpc')
  if (entries.length === 0) {
    return <span className="text-faint">{'{}'}</span>
  }

  return (
    <div className={nestClass(depth)}>
      {entries.map(([key, item]) => {
        const nested = item !== null && typeof item === 'object'
        return (
          <div key={key} className="font-mono text-xs leading-relaxed">
            <div className="flex gap-3">
              <span className="w-28 shrink-0 truncate text-mute" title={key}>
                {key}
              </span>
              {nested ? (
                <span className="text-faint">
                  {Array.isArray(item)
                    ? `[${item.length}]`
                    : `{${Object.keys(item).length}}`}
                </span>
              ) : (
                <span className="min-w-0 break-words text-ink">{scalarText(item)}</span>
              )}
            </div>
            {nested ? (
              <div className="pl-3">
                <JsonTree value={item} depth={depth + 1} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function RpcFrames({ frames }: { frames: ProtocolTraceEntry[] }) {
  return (
    <ol className="space-y-2 pb-3 pt-1">
      {frames.map((frame, index) => {
        const view = rpcFrameView(frame)
        return (
          <li key={`${frame.atMs}:${frame.summary}:${index}`}>
            <div className="flex gap-3 font-mono text-xs">
              <span className="w-4 shrink-0" />
              <span className="w-14 shrink-0" />
              <span className="w-5 shrink-0 text-mute">
                {frame.direction === 'out' ? '→' : '←'}
              </span>
              <span className="min-w-0 text-ink">{view.label}</span>
            </div>
            {view.value !== undefined ? (
              <div className="mt-1 pl-32">
                <JsonTree value={view.value} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function claimTracePane() {
  if (getPane() !== 'trace') {
    activate('trace', 'command')
  }
}

export function ProtocolTrace({
  sourceId,
  onClose,
}: {
  sourceId: string
  onClose: () => void
}) {
  const entries = useMcpTrace(sourceId)
  const groups = useMemo(() => groupProtocolTrace(entries), [entries])
  const [selectedId, setSelectedId] = useState<string>()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const followLatest = useRef(true)
  const listRef = useRef<HTMLElement>(null)

  useEffect(() => {
    claimTracePane()
  }, [])

  useEffect(() => {
    if (groups.length === 0) {
      followLatest.current = true
      setSelectedId(undefined)
      return
    }
    setSelectedId((current) => {
      if (followLatest.current || !groups.some((group) => group.id === current)) {
        return groups[groups.length - 1]?.id
      }
      return current
    })
  }, [groups])

  function move(delta: number) {
    claimTracePane()
    const next = moveSelection(groups, selectedId, delta)
    followLatest.current = next.followLatest
    setSelectedId(next.id)
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelected() {
    if (!selectedId) {
      return
    }
    toggleExpanded(selectedId)
  }

  useStepKeys('trace', move, groups.length > 0)
  usePaneActions('trace', {
    expand: (event) => {
      event.preventDefault()
      toggleSelected()
    },
  })

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-oc-current="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, groups, expanded])

  const found = groups.findIndex((group) => group.id === selectedId)
  const activeIndex = found === -1 ? Math.max(groups.length - 1, 0) : found

  let count = 'No protocol messages yet'
  if (groups.length === 1) {
    count = '1 rpc'
  } else if (groups.length > 1) {
    count = `${groups.length} rpcs`
  }

  return (
    <section
      id="protocol-trace-pane"
      ref={listRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="Protocol traces"
      onPointerEnter={() => {
        if (!consumePointerIntent()) {
          return
        }
        claimTracePane()
      }}
    >
      <div className="oc-bar flex shrink-0 flex-wrap items-center gap-3 px-3 py-2 md:px-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/15"
          onClick={onClose}
        >
          Close traces
          <KeyHints>
            <Kbd hotkey="Escape" />
          </KeyHints>
        </button>
        <p className="font-mono text-xs text-ink">{count}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 md:px-4">
        {groups.length > 0 ? (
          <ol className="w-full font-mono text-sm leading-relaxed">
            {groups.map((group, index) => {
              const active = group.id === selectedId
              const isExpanded = expanded.has(group.id)
              const accent = rpcAccent(group.summary)
              const navigationHint = active
                ? 'Enter'
                : index === activeIndex - 1
                  ? 'K'
                  : index === activeIndex + 1
                    ? 'J'
                    : undefined
              return (
                <li
                  key={group.id}
                  className="exec-context"
                  style={{ '--exec-color': accent } as CSSProperties}
                >
                  <button
                    type="button"
                    data-oc-command-focus="true"
                    data-oc-current={active ? 'true' : undefined}
                    aria-current={active ? 'true' : undefined}
                    aria-expanded={isExpanded}
                    className={`relative flex min-h-7 w-full items-center gap-3 py-1 pr-10 text-left outline-none ${
                      active ? 'exec-active' : ''
                    }`}
                    onClick={() => {
                      claimTracePane()
                      followLatest.current = index === groups.length - 1
                      setSelectedId(group.id)
                      toggleExpanded(group.id)
                    }}
                  >
                    <span className="inline-block w-4 shrink-0 text-faint">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-mute">
                      {group.atMs} ms
                    </span>
                    <span className="w-5 shrink-0 text-mute">
                      {group.direction === 'out' ? '→' : '←'}
                    </span>
                    <span className="min-w-0 truncate exec-ink">{group.summary}</span>
                    <span className="ml-auto shrink-0 text-xs text-faint">
                      {group.frames.length === 1
                        ? group.kind
                        : `${group.frames.length} frames`}
                    </span>
                    {navigationHint ? (
                      <span className="absolute right-3 top-1/2 inline-flex -translate-y-1/2">
                        <Kbd hotkey={navigationHint} />
                      </span>
                    ) : null}
                  </button>
                  {isExpanded ? <RpcFrames frames={group.frames} /> : null}
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    </section>
  )
}
