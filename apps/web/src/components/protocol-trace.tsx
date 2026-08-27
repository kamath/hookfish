import { useSetAtom } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProtocolTraceEntry } from '../lib/client-types'
import { isEditing } from '../lib/focus'
import { protocolTraceOpenAtom } from '../lib/chrome'
import { groupProtocolTrace, type ProtocolRpc } from '../lib/mcp/trace'
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
    <ol className="mt-1 space-y-2 pb-2">
      {frames.map((frame, index) => (
        <li key={`${frame.atMs}:${frame.summary}:${index}`}>
          <div className="flex gap-3 pl-8 font-mono text-[11px] text-mute">
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

export function ProtocolTrace({
  entries,
  onClose,
}: {
  entries: ProtocolTraceEntry[]
  onClose: () => void
}) {
  const groups = useMemo(() => groupProtocolTrace(entries), [entries])
  const [selectedId, setSelectedId] = useState<string>()
  const followLatest = useRef(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const setTraceOpen = useSetAtom(protocolTraceOpenAtom)
  closeRef.current = onClose

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

  useEffect(() => {
    setTraceOpen(true)
    document.documentElement.dataset.ocTrace = 'open'
    return () => {
      setTraceOpen(false)
      delete document.documentElement.dataset.ocTrace
    }
  }, [setTraceOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditing()) {
        return
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (key !== 'j' && key !== 'k' && key !== 'Escape') {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      if (key === 'Escape') {
        closeRef.current()
        return
      }
      const next = moveSelection(groups, selectedId, key === 'j' ? 1 : -1)
      followLatest.current = next.followLatest
      setSelectedId(next.id)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [groups, selectedId])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (panelRef.current?.contains(target)) {
        return
      }
      if (target instanceof Element && target.closest('[data-oc-trace-toggle]')) {
        return
      }
      closeRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLElement>('[data-oc-trace-current="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, groups])

  const found = groups.findIndex((group) => group.id === selectedId)
  const activeIndex = found === -1 ? Math.max(groups.length - 1, 0) : found

  return (
    <div
      ref={panelRef}
      id="protocol-trace-panel"
      data-oc-trace-panel
      role="dialog"
      aria-label="Protocol trace"
      className="absolute inset-x-0 top-full z-20 max-h-[min(36rem,calc(100dvh-9rem))] overflow-auto bg-ink/10 px-3 py-2 md:px-4"
    >
      {groups.length === 0 ? (
        <p className="px-2 py-3 text-xs text-mute">No protocol messages yet.</p>
      ) : (
        <ol className="font-mono text-xs leading-relaxed">
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
                  data-oc-trace-current={active ? 'true' : undefined}
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
                  <span className="ml-auto shrink-0 text-faint">
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
  )
}
