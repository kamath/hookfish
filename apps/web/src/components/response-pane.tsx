import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ExecutionResult } from '../lib/client-types'
import { copyText } from '../lib/clipboard'
import { usePaneActions, usePaneFlags, useStepKeys } from '../lib/keys'
import { Kbd, KeyHints } from './hints'
import { ProtocolTrace } from './protocol-trace'

type ResponseNode = {
  id: string
  label?: string
  value?: unknown
  decoded?: unknown
  depth: number
  raw?: boolean
  toggleId?: string
  children?: ResponseNode[]
  collection?: 'array' | 'object'
  property?: boolean
}

function decodeJsonString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return undefined
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

function buildNode(
  value: unknown,
  id = 'root',
  depth = 0,
  label?: string,
  property = false,
): ResponseNode {
  const decoded = decodeJsonString(value)
  const structure = decoded ?? value
  if (Array.isArray(structure)) {
    return {
      id,
      label,
      value,
      decoded,
      depth,
      collection: 'array',
      children: structure.map((item, index) =>
        buildNode(item, `${id}.${index}`, depth + 1, `[${index}]`),
      ),
      property,
    }
  }
  if (structure !== null && typeof structure === 'object') {
    return {
      id,
      label,
      value,
      decoded,
      depth,
      collection: 'object',
      children: Object.entries(structure).map(([key, item], index) =>
        buildNode(item, `${id}.${index}`, depth + 1, key, true),
      ),
      property,
    }
  }
  return { id, label, value, depth, property }
}

function parseBody(body: string): { root?: ResponseNode; lines?: string[] } {
  if (!body) {
    return { lines: ['Empty body'] }
  }
  try {
    return { root: buildNode(JSON.parse(body)) }
  } catch {
    return { lines: body.split('\n') }
  }
}

function visibleNodes(node: ResponseNode, expanded: Set<string>): ResponseNode[] {
  const rows = [node]
  if (!node.children || !expanded.has(node.id)) {
    return rows
  }
  for (const child of node.children) {
    rows.push(...visibleNodes(child, expanded))
  }
  rows.push({
    id: `${node.id}.close`,
    depth: node.depth,
    raw: true,
    toggleId: node.id,
    value: node.collection === 'array' ? ']' : '}',
  })
  return rows
}

function findNode(node: ResponseNode, id: string): ResponseNode | undefined {
  if (node.id === id) {
    return node
  }
  for (const child of node.children ?? []) {
    const match = findNode(child, id)
    if (match) {
      return match
    }
  }
  return undefined
}

function collectionMark(node: ResponseNode, expanded: boolean) {
  if (!node.collection) {
    return ''
  }
  const [open, close] = node.collection === 'array' ? ['[', ']'] : ['{', '}']
  return expanded ? open : `${open}…${close}`
}

const rowActionClass =
  'inline-flex items-center gap-1.5 bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink hover:bg-ink/15'

function scalarText(value: unknown) {
  const encoded = JSON.stringify(value)
  return encoded === undefined ? String(value) : encoded
}

function selectedJsonText(root: ResponseNode, row: ResponseNode) {
  const node = findNode(root, row.toggleId ?? row.id)
  if (!node) {
    return
  }
  const value = node.decoded ?? node.value
  return JSON.stringify(
    node.property && node.label !== undefined ? { [node.label]: value } : value,
    null,
    2,
  )
}

export function ResponsePane({
  result,
  pending,
  error,
  onBack,
  onResend,
  executeLabel,
  executingLabel,
  onContinue,
}: {
  result: ExecutionResult
  pending: boolean
  error: string | null
  onBack: () => void
  onResend: () => void
  executeLabel: string
  executingLabel: string
  onContinue?: (inputResponses: Record<string, unknown>) => void
}) {
  const body = useMemo(() => parseBody(result.body), [result.body])
  const [detailsVisible, setDetailsVisible] = useState(false)
  const [inputError, setInputError] = useState<string>()
  const [inputResponses, setInputResponses] = useState(() =>
    JSON.stringify(
      Object.fromEntries(
        Object.keys(result.inputRequired?.requests ?? {}).map((name) => [name, {}]),
      ),
      null,
      2,
    ),
  )
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    body.root?.collection ? new Set([body.root.id]) : new Set(),
  )
  const [selected, setSelected] = useState(() => (body.root?.children?.length ? 1 : 0))
  const [copiedId, setCopiedId] = useState<string>()
  const [wrapped, setWrapped] = useState<Set<string>>(new Set())
  const [clipped, setClipped] = useState(false)
  const treeRef = useRef<HTMLDivElement>(null)
  const selectedTextRef = useRef<HTMLSpanElement>(null)
  const rows = useMemo(
    () =>
      body.root
        ? visibleNodes(body.root, expanded)
        : (body.lines ?? []).map((value, index): ResponseNode => ({
            id: `line.${index}`,
            value,
            depth: 0,
            raw: true,
          })),
    [body, expanded],
  )

  useEffect(() => {
    setDetailsVisible(false)
    setInputError(undefined)
    setInputResponses(
      JSON.stringify(
        Object.fromEntries(
          Object.keys(result.inputRequired?.requests ?? {}).map((name) => [name, {}]),
        ),
        null,
        2,
      ),
    )
    setExpanded(body.root?.collection ? new Set([body.root.id]) : new Set())
    setSelected(body.root?.children?.length ? 1 : 0)
    setWrapped(new Set())
  }, [body, result])

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(rows.length - 1, 0)))
  }, [rows.length])

  const measureSelected = useCallback(() => {
    const text = selectedTextRef.current
    setClipped(text ? text.scrollWidth > text.clientWidth + 1 : false)
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

  function canUnclip(node: ResponseNode) {
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

  async function copyRow(row: ResponseNode | undefined) {
    if (!body.root || !row) {
      return
    }
    const text = selectedJsonText(body.root, row)
    if (text === undefined) {
      return
    }
    if (await copyText(text)) {
      setCopiedId(row.id)
    }
  }

  function toggleSelectedChildren() {
    if (!body.root) {
      return
    }
    const selectedNode = rows[selected]
    const id = selectedNode?.toggleId ?? (selectedNode?.collection ? selectedNode.id : undefined)
    if (!id) {
      return
    }
    const root = findNode(body.root, id)
    if (!root) {
      return
    }
    const ids: string[] = []
    const visit = (node: ResponseNode) => {
      if (node.collection) {
        ids.push(node.id)
      }
      node.children?.forEach(visit)
    }
    visit(root)
    setExpanded((current) => {
      const next = new Set(current)
      const allExpanded = ids.every((nodeId) => current.has(nodeId))
      if (!allExpanded) {
        ids.forEach((nodeId) => next.add(nodeId))
        return next
      }
      next.add(root.id)
      ids.slice(1).forEach((nodeId) => next.delete(nodeId))
      return next
    })
  }

  const activeRow = rows[selected]
  const firstActiveChildId = activeRow?.children?.[0]?.id
  const canToggleChildren = Boolean(activeRow?.collection)
  usePaneFlags('response', {
    canToggleChildren,
    hasDetails: Boolean(result.details?.items.length),
    hasJson: Boolean(body.root),
  })
  useStepKeys('response', move)
  usePaneActions('response', {
    expand: (event) => {
      event.preventDefault()
      toggleSelected()
    },
    copy: (event) => {
      event.preventDefault()
      void copyRow(rows[selected])
    },
    resend: (event) => {
      event.preventDefault()
      if (!pending) {
        onResend()
      }
    },
    details: () => setDetailsVisible((visible) => !visible),
    children: () => toggleSelectedChildren(),
  })

  return (
    <section id="response-pane" className="flex h-full min-h-0 min-w-0 flex-col" aria-live="polite">
      <div className="oc-bar flex flex-wrap items-center gap-3 px-3 py-2 md:px-4">
        {result.status ? (
          <p className="font-mono text-xs tabular-nums text-ink">
            {result.status.code !== undefined ? `${result.status.code} ` : ''}
            {result.status.text}
          </p>
        ) : null}
        <p className="font-mono text-xs text-faint">
          {new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0,
          }).format(result.elapsedMs)}
          &nbsp;ms
        </p>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/15"
            onClick={onBack}
          >
            Edit input
            <KeyHints>
              <Kbd hotkey="Escape" />
            </KeyHints>
          </button>
          <button
            type="button"
            className="exec-solid inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium disabled:bg-faint"
            disabled={pending}
            onClick={onResend}
          >
            {pending ? executingLabel : executeLabel}
            <KeyHints>
              <Kbd hotkey="Mod+Enter" />
            </KeyHints>
          </button>
        </div>
      </div>

      {error ? (
        <p className="oc-bar px-3 py-2 text-xs text-signal md:px-4" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 md:px-4">
        {result.inputRequired && onContinue ? (
          <section className="mb-3 bg-ink/5 px-3 py-3">
            <p className="text-sm text-ink">The server needs additional client input.</p>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs text-mute">
              {JSON.stringify(result.inputRequired.requests, null, 2)}
            </pre>
            <label className="mt-3 block">
              <span className="text-xs text-mute">Input responses (JSON)</span>
              <textarea
                className="mt-1 min-h-32 w-full resize-y bg-paper px-2 py-2 font-mono text-xs text-ink outline-none focus:bg-white"
                value={inputResponses}
                onChange={(event) => setInputResponses(event.target.value)}
              />
            </label>
            {inputError ? (
              <p className="mt-2 text-xs text-error" role="alert">
                {inputError}
              </p>
            ) : null}
            <button
              type="button"
              className="exec-solid mt-2 px-3 py-1.5 text-sm font-medium"
              disabled={pending}
              onClick={() => {
                try {
                  const parsed = JSON.parse(inputResponses) as unknown
                  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Responses must be a JSON object.')
                  }
                  setInputError(undefined)
                  onContinue(parsed as Record<string, unknown>)
                } catch (nextError) {
                  setInputError(
                    nextError instanceof Error ? nextError.message : 'Enter valid JSON.',
                  )
                }
              }}
            >
              {pending ? executingLabel : 'Continue'}
            </button>
          </section>
        ) : null}

        <ProtocolTrace entries={result.trace ?? []} />

        {result.details && result.details.items.length > 0 ? (
          <div className="mb-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 font-mono text-xs text-mute hover:text-ink"
              aria-expanded={detailsVisible}
              onClick={() => setDetailsVisible((visible) => !visible)}
            >
              {detailsVisible ? '▾' : '▸'} {result.details.label} (
              {result.details.items.length})
              <Kbd hotkey="H" />
            </button>
            {detailsVisible ? (
              <dl className="mt-2 space-y-1 border-l border-rule pl-3">
                {result.details.items.map((item) => (
                  <div key={`${item.name}:${item.value}`}>
                    <dt className="font-mono text-[11px] text-faint">{item.name}</dt>
                    <dd className="break-words font-mono text-xs">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

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
                      (node.collection && !showEncoded) || node.toggleId
                        ? 'text-faint'
                        : 'text-ink'
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
                      {body.root ? (
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
      </div>
    </section>
  )
}
