import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProtocolTraceEntry } from '../lib/client-types'
import { useStepKeys } from '../lib/keys'
import { groupProtocolTrace, useMcpTrace, type ProtocolRpc } from '../lib/mcp/trace'
import { Kbd } from './hints'

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
    <pre className="mt-1 overflow-auto whitespace-pre-wrap pl-[4.75rem] font-mono text-[11px] leading-relaxed text-faint">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function RpcFrames({ frames }: { frames: ProtocolTraceEntry[] }) {
  return (
    <ol className="mt-1 space-y-2 pb-3">
      {frames.map((frame, index) => (
        <li key={`${frame.atMs}:${frame.summary}:${index}`}>
          <div className="flex gap-3 pl-8 font-mono text-xs text-mute">
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

export function ProtocolTrace({ sourceId }: { sourceId: string }) {
  const entries = useMcpTrace(sourceId)
  const groups = useMemo(() => groupProtocolTrace(entries), [entries])
  const [selectedId, setSelectedId] = useState<string>()
  const followLatest = useRef(true)
  const listRef = useRef<HTMLElement>(null)

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
    const next = moveSelection(groups, selectedId, delta)
    followLatest.current = next.followLatest
    setSelectedId(next.id)
  }

  useStepKeys('trace', move, groups.length > 0)

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-oc-current="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, groups])

  const found = groups.findIndex((group) => group.id === selectedId)
  const activeIndex = found === -1 ? Math.max(groups.length - 1, 0) : found

  return (
    <section
      id="protocol-trace-pane"
      ref={listRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="Protocol trace"
    >
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 md:px-4">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-sm text-mute">No protocol messages yet.</p>
        ) : (
          <ol className="w-max min-w-full font-mono text-sm leading-relaxed">
            {groups.map((group, index) => {
              const active = group.id === selectedId
              const navigationHint = active
                ? undefined
                : index === activeIndex - 1
                  ? 'K'
                  : index === activeIndex + 1
                    ? 'J'
                    : undefined
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    data-oc-command-focus="true"
                    data-oc-current={active ? 'true' : undefined}
                    aria-current={active ? 'true' : undefined}
                    aria-expanded={active}
                    className={`flex min-h-7 w-full items-center gap-3 py-1 text-left outline-none ${
                      active ? 'exec-active' : ''
                    }`}
                    onClick={() => {
                      followLatest.current = index === groups.length - 1
                      setSelectedId(group.id)
                    }}
                  >
                    <span className="inline-flex w-8 shrink-0 justify-end">
                      {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-mute">
                      {group.atMs} ms
                    </span>
                    <span className="w-5 shrink-0 text-mute">
                      {group.direction === 'out' ? '→' : '←'}
                    </span>
                    <span className="min-w-0 truncate text-ink">{group.summary}</span>
                    <span className="ml-auto shrink-0 text-xs text-faint">
                      {group.frames.length === 1
                        ? group.kind
                        : `${group.frames.length} frames`}
                    </span>
                  </button>
                  {active ? <RpcFrames frames={group.frames} /> : null}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
