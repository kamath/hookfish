import { useEffect, useMemo, useState } from 'react'
import type { ExecutionResult } from '../lib/client-types'
import { copyText } from '../lib/clipboard'
import { usePaneActions, usePaneFlags, useStepKeys } from '../lib/keys'
import { Kbd, KeyHints } from './hints'
import { ProtocolTrace } from './protocol-trace'

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
      value,
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
      value,
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

function nodeCopyText(node: ResponseNode, root?: ResponseNode) {
  const target = node.toggleId && root ? (findNode(root, node.toggleId) ?? node) : node
  if (target.raw) {
    return String(target.value)
  }
  const encoded = JSON.stringify(target.value, null, 2)
  return encoded === undefined ? String(target.value) : encoded
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
  const [copiedNodeId, setCopiedNodeId] = useState<string>()
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
    setCopiedNodeId(undefined)
  }, [body, result])

  useEffect(() => {
    if (!copiedNodeId) {
      return
    }
    const timer = window.setTimeout(() => setCopiedNodeId(undefined), 1500)
    return () => window.clearTimeout(timer)
  }, [copiedNodeId])

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(rows.length - 1, 0)))
  }, [rows.length])

  function move(delta: number) {
    setSelected((current) => Math.min(Math.max(current + delta, 0), Math.max(rows.length - 1, 0)))
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

  async function copyNode(node: ResponseNode) {
    const copied = await copyText(nodeCopyText(node, body.root))
    setCopiedNodeId(copied ? node.id : undefined)
  }

  const activeRow = rows[selected]
  const firstActiveChildId = activeRow?.children?.[0]?.id
  const canToggleChildren = Boolean(activeRow?.collection)
  usePaneFlags('response', {
    canToggleChildren,
    hasDetails: Boolean(result.details?.items.length),
  })
  useStepKeys('response', move)
  usePaneActions('response', {
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
    details: () => setDetailsVisible((visible) => !visible),
    children: () => toggleSelectedChildren(),
    copyNode: (event) => {
      event.preventDefault()
      const node = rows[selected]
      if (node) {
        void copyNode(node)
      }
    },
  })

  return (
    <section id="response-pane" className="flex h-full min-h-0 min-w-0 flex-col" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-3 py-2 md:px-4">
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
        <p className="border-b border-rule px-3 py-2 text-xs text-signal md:px-4" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 md:px-4">
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

        <div className="min-w-0 w-full font-mono text-sm leading-relaxed" role="tree">
          {rows.map((node, index) => {
            const isExpanded = expanded.has(node.id)
            const isActive = index === selected
            const isCopied = copiedNodeId === node.id
            const navigationHint =
              isActive && (node.collection || node.toggleId)
                ? 'Enter'
                : index === selected - 1
                  ? 'K'
                  : index === selected + 1
                    ? 'J'
                    : undefined
            const childrenHint = node.id === firstActiveChildId ? 'A' : undefined
            return (
              <div
                key={node.id}
                role="treeitem"
                aria-current={isActive ? 'true' : undefined}
                aria-expanded={node.collection ? isExpanded : undefined}
                data-oc-current={isActive ? 'true' : undefined}
                className={`flex min-h-6 w-full min-w-0 ${
                  isActive ? 'exec-active items-start' : 'items-center'
                }`}
              >
                <button
                  type="button"
                  className={`flex min-h-6 min-w-0 text-left outline-none ${
                    isActive ? 'items-start pr-1' : 'flex-1 items-center pr-3'
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
                    className="inline-flex shrink-0 items-center"
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
                    className={`min-w-0 ${
                      isActive
                        ? 'whitespace-pre-wrap break-words'
                        : 'flex-1 overflow-hidden text-ellipsis whitespace-pre'
                    }`}
                  >
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
                  </span>
                </button>
                {isActive ? (
                  <button
                    type="button"
                    className="inline-flex min-h-6 shrink-0 items-center gap-1.5 bg-ink/10 px-2 text-xs font-medium text-ink outline-none hover:bg-ink/15"
                    aria-label={
                      isCopied
                        ? 'Copied JSON node'
                        : `Copy ${node.label ?? 'JSON node'} and descendants`
                    }
                    title={isCopied ? 'Copied' : 'Copy node and descendants'}
                    onClick={() => {
                      void copyNode(node)
                    }}
                  >
                    <Kbd hotkey="Y" />
                    {isCopied ? (
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="m3 8.5 3 3 7-7"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M5.5 5.5h7v7h-7zM3.5 10.5h-1v-7h7v1"
                          fill="none"
                          stroke="currentColor"
                          strokeLinejoin="round"
                          strokeWidth="1.25"
                        />
                      </svg>
                    )}
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
