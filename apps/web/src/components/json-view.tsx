import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildNode,
  collectionMark,
  findNode,
  lineNodes,
  parseJsonBody,
  scalarText,
  selectedJsonText,
  visibleNodes,
  type JsonNode,
} from '../lib/json-tree'
import { copyText } from '../lib/clipboard'
import { usePaneActions, usePaneFlags, useStepKeys } from '../lib/keys'
import type { Pane } from '../lib/mode'
import { Kbd, KeyHints } from './hints'

const rowActionClass =
  'inline-flex items-center gap-1.5 bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink hover:bg-ink/15'

export function JsonView({
  value,
  text,
  pane,
  enabled = true,
  copyAction = 'copy',
}: {
  value?: unknown
  text?: string
  pane: Pane
  enabled?: boolean
  copyAction?: 'copy' | 'export'
}) {
  const parsed = useMemo(() => {
    if (text !== undefined) {
      return parseJsonBody(text)
    }
    if (value === undefined) {
      return { lines: ['Nothing to inspect.'] }
    }
    return { root: buildNode(value) }
  }, [text, value])
  const [expanded, setExpanded] = useState(() =>
    parsed.root?.collection ? new Set([parsed.root.id]) : new Set<string>(),
  )
  const [selected, setSelected] = useState(() => (parsed.root?.children?.length ? 1 : 0))
  const [copiedId, setCopiedId] = useState<string>()
  const [wrapped, setWrapped] = useState<Set<string>>(new Set())
  const [clipped, setClipped] = useState(false)
  const treeRef = useRef<HTMLDivElement>(null)
  const selectedTextRef = useRef<HTMLSpanElement>(null)
  const rows = useMemo(
    () => (parsed.root ? visibleNodes(parsed.root, expanded) : lineNodes(parsed.lines ?? [])),
    [expanded, parsed],
  )

  useEffect(() => {
    setExpanded(parsed.root?.collection ? new Set([parsed.root.id]) : new Set())
    setSelected(parsed.root?.children?.length ? 1 : 0)
    setWrapped(new Set())
  }, [parsed])

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(rows.length - 1, 0)))
  }, [rows.length])

  const measureSelected = useCallback(() => {
    const textNode = selectedTextRef.current
    setClipped(textNode ? textNode.scrollWidth > textNode.clientWidth + 1 : false)
  }, [])

  useLayoutEffect(measureSelected)

  useEffect(() => {
    const tree = treeRef.current
    if (!tree || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(measureSelected)
    observer.observe(tree)
    return () => observer.disconnect()
  }, [measureSelected])

  useEffect(() => {
    if (!copiedId) {
      return
    }
    const timer = window.setTimeout(() => setCopiedId(undefined), 1500)
    return () => window.clearTimeout(timer)
  }, [copiedId])

  function move(delta: number) {
    setSelected((current) => Math.min(Math.max(current + delta, 0), Math.max(rows.length - 1, 0)))
  }

  function toggleNode(id: string) {
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

  function canUnclip(node: JsonNode) {
    if (node.collection || node.toggleId) {
      return false
    }
    return wrapped.has(node.id) || (rows[selected]?.id === node.id && clipped)
  }

  function toggleWrap(id: string) {
    setWrapped((current) => {
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
    const node = rows[selected]
    if (!node) {
      return
    }
    const id = node.toggleId ?? (node.collection ? node.id : undefined)
    if (id) {
      toggleNode(id)
      return
    }
    if (canUnclip(node)) {
      toggleWrap(node.id)
    }
  }

  async function copyRow(row: JsonNode | undefined) {
    if (!parsed.root || !row) {
      return
    }
    const next = selectedJsonText(parsed.root, row)
    if (next === undefined) {
      return
    }
    if (await copyText(next)) {
      setCopiedId(row.id)
    }
  }

  function toggleSelectedChildren() {
    if (!parsed.root) {
      return
    }
    const selectedNode = rows[selected]
    const id = selectedNode?.toggleId ?? (selectedNode?.collection ? selectedNode.id : undefined)
    if (!id) {
      return
    }
    const target = findNode(parsed.root, id)
    if (!target) {
      return
    }
    const ids: string[] = []
    const visit = (node: JsonNode) => {
      if (node.collection) {
        ids.push(node.id)
      }
      node.children?.forEach(visit)
    }
    visit(target)
    setExpanded((current) => {
      const next = new Set(current)
      const allExpanded = ids.every((nodeId) => current.has(nodeId))
      if (!allExpanded) {
        ids.forEach((nodeId) => next.add(nodeId))
        return next
      }
      next.add(target.id)
      ids.slice(1).forEach((nodeId) => next.delete(nodeId))
      return next
    })
  }

  const activeRow = rows[selected]
  const firstActiveChildId = activeRow?.children?.[0]?.id
  const canToggleChildren = Boolean(activeRow?.collection)
  usePaneFlags(pane, {
    canToggleChildren: enabled && canToggleChildren,
    hasJson: enabled && Boolean(parsed.root),
  })
  useStepKeys(pane, move, enabled)
  usePaneActions(pane, {
    next: { callback: () => move(1), enabled },
    previous: { callback: () => move(-1), enabled },
    nextTab: { callback: () => move(1), enabled, ignoreInputs: false },
    previousTab: { callback: () => move(-1), enabled, ignoreInputs: false },
    expand: {
      callback: (event) => {
        event.preventDefault()
        toggleSelected()
      },
      enabled,
    },
    [copyAction]: {
      callback: (event: KeyboardEvent) => {
        event.preventDefault()
        void copyRow(rows[selected])
      },
      enabled,
    },
    children: {
      callback: () => toggleSelectedChildren(),
      enabled,
    },
  })

  return (
    <div
      ref={treeRef}
      className="w-full min-w-0 overflow-hidden font-mono text-sm leading-relaxed"
      role="tree"
    >
      {rows.map((node, index) => {
        const isExpanded = expanded.has(node.id)
        const isSelected = index === selected
        const isWrapped = wrapped.has(node.id)
        const navigationHint =
          index === selected - 1 ? 'K' : index === selected + 1 ? 'J' : undefined
        const childrenHint = node.id === firstActiveChildId ? 'A' : undefined
        const showEncoded = Boolean(node.decoded) && !isExpanded
        const expandable = node.collection ? true : canUnclip(node)
        const showsAll = node.collection ? isExpanded : isWrapped
        return (
          <div
            key={node.id}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={expandable ? showsAll : undefined}
            data-oc-current={isSelected ? 'true' : undefined}
            className={`flex min-h-6 w-full min-w-0 overflow-hidden whitespace-nowrap pr-3 text-left ${
              isWrapped ? 'items-start' : 'items-center'
            } ${isSelected ? 'exec-active' : ''}`}
            style={{ paddingInlineStart: '0.25rem' }}
            onClick={() => {
              setSelected(index)
              if (node.collection) {
                toggleNode(node.id)
              } else if (canUnclip(node)) {
                toggleWrap(node.id)
              }
            }}
          >
            <span
              className="inline-flex items-center"
              style={{ marginInlineStart: `${node.depth * 1.25}rem` }}
            >
              <span className="inline-block w-4 text-faint">
                {node.collection ? (isExpanded ? '▾' : '▸') : ''}
              </span>
              {childrenHint ? (
                <span className="mr-2 inline-flex">
                  <Kbd hotkey={childrenHint} />
                </span>
              ) : null}
            </span>
            <span
              ref={isSelected ? selectedTextRef : undefined}
              className={`min-w-0 flex-1 ${
                isWrapped ? 'whitespace-pre-wrap break-words' : 'truncate'
              }`}
            >
              {node.label !== undefined ? (
                <span className="text-mute">{node.label}: </span>
              ) : null}
              <span
                className={
                  (node.collection && !showEncoded) || node.toggleId ? 'text-faint' : 'text-ink'
                }
              >
                {node.collection && !showEncoded
                  ? collectionMark(node, isExpanded)
                  : node.raw
                    ? String(node.value)
                    : scalarText(node.value)}
              </span>
            </span>
            <span className="ml-3 flex shrink-0 items-center gap-2">
              {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
              {isSelected ? (
                <>
                  {expandable ? (
                    <button
                      type="button"
                      className={rowActionClass}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (node.collection) {
                          toggleNode(node.id)
                        } else {
                          toggleWrap(node.id)
                        }
                      }}
                    >
                      {showsAll ? 'Collapse' : 'Expand'}
                      <KeyHints>
                        <Kbd hotkey="Enter" />
                      </KeyHints>
                    </button>
                  ) : null}
                  {parsed.root ? (
                    <button
                      type="button"
                      className={rowActionClass}
                      onClick={(event) => {
                        event.stopPropagation()
                        void copyRow(node)
                      }}
                    >
                      {copiedId === node.id ? 'Copied' : 'Copy'}
                      <KeyHints>
                        <Kbd hotkey="Y" />
                      </KeyHints>
                    </button>
                  ) : null}
                </>
              ) : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
