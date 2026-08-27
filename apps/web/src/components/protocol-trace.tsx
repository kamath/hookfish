import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ProtocolTraceEntry } from '../lib/client-types'
import { consumePointerIntent, usePaneActions, useStepKeys } from '../lib/keys'
import { activate, getPane } from '../lib/mode'
import {
  groupProtocolTrace,
  rpcAccent,
  useMcpTrace,
  type ProtocolRpc,
} from '../lib/mcp/trace'
import { Kbd } from './hints'
import { PaneBackButton } from './pane-back-button'

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

function revealInList(row: HTMLElement | null, list: HTMLElement | null) {
  if (!row || !list) {
    return
  }
  const rowRect = row.getBoundingClientRect()
  const listRect = list.getBoundingClientRect()
  if (rowRect.top < listRect.top) {
    list.scrollTop -= listRect.top - rowRect.top
  } else if (rowRect.bottom > listRect.bottom) {
    list.scrollTop += rowRect.bottom - listRect.bottom
  }
}

function revealExpandedInList(
  title: HTMLElement | null,
  item: HTMLElement | null,
  list: HTMLElement | null,
) {
  if (!title || !item || !list) {
    return
  }
  const listRect = list.getBoundingClientRect()
  const titleRect = title.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  if (titleRect.top < listRect.top) {
    list.scrollTop -= listRect.top - titleRect.top
    return
  }
  if (itemRect.bottom <= listRect.bottom) {
    return
  }
  list.scrollTop += Math.min(
    itemRect.bottom - listRect.bottom,
    titleRect.top - listRect.top,
  )
}

type JsonToken = {
  text: string
  kind: 'key' | 'string' | 'number' | 'literal' | 'punct' | 'space'
}

function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i] ?? ''
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      let end = i + 1
      while (end < source.length && ' \n\r\t'.includes(source[end] ?? '')) {
        end += 1
      }
      tokens.push({ text: source.slice(i, end), kind: 'space' })
      i = end
      continue
    }
    if (ch === '"') {
      let end = i + 1
      while (end < source.length) {
        if (source[end] === '\\') {
          end += 2
          continue
        }
        if (source[end] === '"') {
          end += 1
          break
        }
        end += 1
      }
      const text = source.slice(i, end)
      let next = end
      while (next < source.length && ' \n\r\t'.includes(source[next] ?? '')) {
        next += 1
      }
      tokens.push({ text, kind: source[next] === ':' ? 'key' : 'string' })
      i = end
      continue
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let end = i + 1
      while (end < source.length && /[0-9.eE+-]/.test(source[end] ?? '')) {
        end += 1
      }
      tokens.push({ text: source.slice(i, end), kind: 'number' })
      i = end
      continue
    }
    if (source.startsWith('true', i) || source.startsWith('null', i)) {
      const text = source.startsWith('true', i) ? 'true' : 'null'
      tokens.push({ text, kind: 'literal' })
      i += text.length
      continue
    }
    if (source.startsWith('false', i)) {
      tokens.push({ text: 'false', kind: 'literal' })
      i += 5
      continue
    }
    tokens.push({ text: ch, kind: 'punct' })
    i += 1
  }
  return tokens
}

const jsonTokenClass: Record<JsonToken['kind'], string> = {
  key: 'text-mute',
  string: 'text-ink',
  number: 'text-ink',
  literal: 'text-faint',
  punct: 'text-faint',
  space: '',
}

function JsonBlock({ value }: { value: unknown }) {
  const source = JSON.stringify(value, null, 2)
  if (source === undefined) {
    return null
  }
  return (
    <pre className="mt-1 overflow-auto whitespace-pre-wrap pl-[5.75rem] font-mono text-[11px] leading-relaxed">
      {tokenizeJson(source).map((token, index) =>
        token.kind === 'space' ? (
          token.text
        ) : (
          <span key={index} className={jsonTokenClass[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </pre>
  )
}

function RpcFrames({ frames }: { frames: ProtocolTraceEntry[] }) {
  return (
    <ol className="col-span-full mt-1 space-y-2 pb-3">
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
  const listRef = useRef<HTMLDivElement>(null)
  const prevExpanded = useRef(expanded)

  function revealRpc(id: string | undefined) {
    if (!id) {
      return
    }
    revealInList(document.getElementById(`rpc-${id}`), listRef.current)
  }

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
    revealRpc(next.id)
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

  useLayoutEffect(() => {
    revealRpc(selectedId)
  }, [selectedId])

  useLayoutEffect(() => {
    let added: string | undefined
    for (const id of expanded) {
      if (!prevExpanded.current.has(id)) {
        added = id
        break
      }
    }
    prevExpanded.current = expanded
    if (!added) {
      return
    }
    const title = document.getElementById(`rpc-${added}`)
    const item = document.getElementById(`rpc-block-${added}`)
    revealExpandedInList(title, item, listRef.current)
  }, [expanded])

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
        <PaneBackButton label="Close traces" onClick={onClose} />
        <p className="font-mono text-xs text-ink">{count}</p>
      </div>
      <div
        ref={listRef}
        data-trace-list
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 py-3 md:px-4"
      >
        {groups.length > 0 ? (
          <ol className="grid w-full min-w-0 grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] gap-x-3 font-mono text-sm leading-relaxed">
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
                  id={`rpc-block-${group.id}`}
                  className="exec-context col-span-full grid grid-cols-subgrid"
                  style={{ '--exec-color': accent } as CSSProperties}
                >
                  <button
                    id={`rpc-${group.id}`}
                    type="button"
                    data-oc-command-focus="true"
                    data-oc-current={active ? 'true' : undefined}
                    aria-current={active ? 'true' : undefined}
                    aria-expanded={isExpanded}
                    className={`relative col-span-full grid min-h-7 grid-cols-subgrid items-center py-1 pr-10 text-left outline-none ${
                      active ? 'exec-active' : ''
                    }`}
                    onFocus={() => {
                      claimTracePane()
                      followLatest.current = index === groups.length - 1
                      setSelectedId(group.id)
                      revealRpc(group.id)
                    }}
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
                    <span className="whitespace-nowrap text-right tabular-nums text-mute">
                      {group.atMs}ms
                    </span>
                    <span className="w-5 shrink-0 text-mute">
                      {group.direction === 'out' ? '→' : '←'}
                    </span>
                    <span className="min-w-0 truncate exec-ink">{group.summary}</span>
                    <span className="shrink-0 text-xs text-faint">
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
