import { useEffect, useMemo, useState } from 'react'
import type { InvokeResult } from '../lib/client-types'
import { useStepKeys, useViewActions } from '../lib/keys'
import { Kbd, KeyHints } from './hints'

type ResponseNode = {
  id: string
  label?: string
  value?: unknown
  depth: number
  raw?: boolean
  toggleId?: string
  children?: ResponseNode[]
  collection?: 'array' | 'object'
}

function buildNode(value: unknown, id = 'root', depth = 0, label?: string): ResponseNode {
  if (Array.isArray(value)) {
    return {
      id,
      label,
      depth,
      collection: 'array',
      children: value.map((item, index) =>
        buildNode(item, `${id}.${index}`, depth + 1, `[${index}]`),
      ),
    }
  }
  if (value !== null && typeof value === 'object') {
    return {
      id,
      label,
      depth,
      collection: 'object',
      children: Object.entries(value).map(([key, item], index) =>
        buildNode(item, `${id}.${index}`, depth + 1, key),
      ),
    }
  }
  return { id, label, value, depth }
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

function scalarText(value: unknown) {
  const encoded = JSON.stringify(value)
  return encoded === undefined ? String(value) : encoded
}

export function ResponsePane({
  result,
  pending,
  error,
  onBack,
  onResend,
}: {
  result: InvokeResult
  pending: boolean
  error: string | null
  onBack: () => void
  onResend: () => void
}) {
  const body = useMemo(() => parseBody(result.body), [result.body])
  const [headersVisible, setHeadersVisible] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    body.root?.collection ? new Set([body.root.id]) : new Set(),
  )
  const [selected, setSelected] = useState(() =>
    body.root?.children?.length ? 1 : 0,
  )
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
    setHeadersVisible(false)
    setExpanded(body.root?.collection ? new Set([body.root.id]) : new Set())
    setSelected(body.root?.children?.length ? 1 : 0)
  }, [body, result])

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(rows.length - 1, 0)))
  }, [rows.length])

  function move(delta: number) {
    setSelected((current) =>
      Math.min(Math.max(current + delta, 0), Math.max(rows.length - 1, 0)),
    )
  }

  function toggleSelected() {
    const node = rows[selected]
    const id = node?.toggleId ?? (node?.collection ? node.id : undefined)
    if (!id) {
      return
    }
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

  function toggleSelectedChildren() {
    if (!body.root) {
      return
    }
    const selectedNode = rows[selected]
    const id =
      selectedNode?.toggleId ?? (selectedNode?.collection ? selectedNode.id : undefined)
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

  useStepKeys('response', move)
  useViewActions('response', {
    expand: (event) => {
      event.preventDefault()
      if (rows[selected]?.collection || rows[selected]?.toggleId) {
        toggleSelected()
      }
    },
    resend: (event) => {
      event.preventDefault()
      if (!pending) {
        onResend()
      }
    },
    tabNext: (event) => {
      event.preventDefault()
      move(1)
    },
    tabPrev: (event) => {
      event.preventDefault()
      move(-1)
    },
    headers: () => setHeadersVisible((visible) => !visible),
    children: () => toggleSelectedChildren(),
    request: (event) => {
      event.preventDefault()
      onBack()
    },
  })

  return (
    <section
      id="response-pane"
      className="flex h-full min-h-0 min-w-0 flex-col"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-3 py-2 md:px-4">
        <p className="font-mono text-xs tabular-nums text-ink">
          {result.status} {result.statusText}
        </p>
        <p className="font-mono text-xs text-faint">
          {new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
            result.elapsedMs,
          )}
          &nbsp;ms
        </p>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/15"
            onClick={onBack}
          >
            Edit request
            <KeyHints>
              <Kbd hotkey="Escape" />
            </KeyHints>
          </button>
          <button
            type="button"
            className="api-solid inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium disabled:bg-faint"
            disabled={pending}
            onClick={onResend}
          >
            {pending ? 'Sending…' : 'Resend'}
            <KeyHints>
              <Kbd hotkey="Mod+Enter" />
            </KeyHints>
          </button>
        </div>
      </div>

      {error ? (
        <p className="border-b border-rule px-3 py-2 text-xs text-signal md:px-4" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 md:px-4">
        {result.headers.length > 0 ? (
          <div className="mb-3">
            <button
              type="button"
              className="font-mono text-xs text-mute hover:text-ink"
              aria-expanded={headersVisible}
              onClick={() => setHeadersVisible((visible) => !visible)}
            >
              {headersVisible ? '▾' : '▸'} Headers ({result.headers.length})
            </button>
            {headersVisible ? (
              <dl className="mt-2 space-y-1 border-l border-rule pl-3">
                {result.headers.map((header) => (
                  <div key={`${header.name}:${header.value}`}>
                    <dt className="font-mono text-[11px] text-faint">{header.name}</dt>
                    <dd className="break-words font-mono text-xs">{header.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        <div className="w-max min-w-full font-mono text-sm leading-relaxed" role="tree">
          {rows.map((node, index) => {
            const isExpanded = expanded.has(node.id)
            const navigationHint =
              index === selected && (node.collection || node.toggleId)
                ? 'Enter'
                : index === selected - 1
                  ? 'K'
                  : index === selected + 1
                    ? 'J'
                    : undefined
            const childrenHint =
              index === 1 && index === selected && node.collection ? 'A' : undefined
            return (
              <button
                key={node.id}
                type="button"
                role="treeitem"
                aria-current={index === selected ? 'true' : undefined}
                aria-expanded={node.collection ? isExpanded : undefined}
                data-oc-current={index === selected ? 'true' : undefined}
                className={`flex min-h-6 w-full items-center whitespace-pre pr-3 text-left outline-none ${
                  index === selected ? 'api-active' : ''
                }`}
                style={{ paddingInlineStart: '0.25rem' }}
                onClick={() => {
                  setSelected(index)
                  if (node.collection) {
                    setExpanded((current) => {
                      const next = new Set(current)
                      if (next.has(node.id)) {
                        next.delete(node.id)
                      } else {
                        next.add(node.id)
                      }
                      return next
                    })
                  }
                }}
              >
                <span className="inline-flex w-8 shrink-0 justify-end pr-2">
                  {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
                </span>
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
                {node.label !== undefined ? (
                  <span className="text-mute">{node.label}: </span>
                ) : null}
                <span
                  className={node.collection || node.toggleId ? 'text-faint' : 'text-ink'}
                >
                  {node.collection
                    ? collectionMark(node, isExpanded)
                    : node.raw
                      ? String(node.value)
                      : scalarText(node.value)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
