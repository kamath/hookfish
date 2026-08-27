import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ProtocolTraceEntry } from '../lib/client-types'
import { consumePointerIntent, usePaneActions, useStepKeys } from '../lib/keys'
import { activate, getPane } from '../lib/mode'
import { groupProtocolTrace, rpcAccent, useMcpTrace, type ProtocolRpc } from '../lib/mcp/trace'
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-1 overflow-auto whitespace-pre-wrap pl-[5.75rem] font-mono text-[11px] leading-relaxed text-faint">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function RpcFrames({ frames }: { frames: ProtocolTraceEntry[] }) {
  return (
    <ol className="mt-1 space-y-2 pb-3">
      {frames.map((frame, index) => (
        <li key={`${frame.atMs}:${frame.summary}:${index}`}>
          <div className="flex gap-3 pl-12 font-mono text-xs text-mute">
            <span className="w-5 shrink-0">{frame.direction === 'out' ? '→' : '←'}</span>
            <span className="w-20 shrink-0 text-faint">{frame.kind}</span>
            <span className="min-w-0 text-ink">{frame.summary}</span>
          </div>
          {frame.detail !== undefined ? <JsonBlock value={frame.detail} /> : null}
        </li>
      ))}
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

  return (
    <section
      id="protocol-trace-pane"
      ref={listRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="Protocol trace"
      onPointerEnter={() => {
        if (!consumePointerIntent()) {
          return
        }
        claimTracePane()
      }}
    >
      <div className="oc-bar flex shrink-0 flex-wrap items-center gap-3 px-3 py-2 md:px-4">
        <p className="font-mono text-xs text-ink">
          {groups.length === 0
            ? 'No protocol messages yet'
            : `${groups.length} ${groups.length === 1 ? 'rpc' : 'rpcs'}`}
        </p>
        <div className="ml-auto">
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/15"
            onClick={onClose}
          >
            Close trace
            <KeyHints>
              <Kbd hotkey="T" />
            </KeyHints>
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 md:px-4">
        {groups.length > 0 ? (
          <ol className="w-max min-w-full font-mono text-sm leading-relaxed">
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
                    className={`flex min-h-7 w-full items-center gap-3 py-1 text-left outline-none ${
                      active ? 'exec-active' : ''
                    }`}
                    onClick={() => {
                      claimTracePane()
                      followLatest.current = index === groups.length - 1
                      setSelectedId(group.id)
                      toggleExpanded(group.id)
                    }}
                  >
                    <span className="inline-flex w-8 shrink-0 justify-end">
                      {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
                    </span>
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
                  </button>
                  {isExpanded ? <RpcFrames frames={group.frames} /> : null}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
