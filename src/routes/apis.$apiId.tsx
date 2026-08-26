import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from '@tanstack/react-hotkeys'
import { AuthStep } from '../components/auth-step'
import { HintBar } from '../components/hints'
import { OperationClient } from '../components/operation-client'
import { getApi } from '../lib/apis.functions'
import { fieldsFromForm, saveApiAuth } from '../lib/auth.functions'
import type { ClientApi, ClientOperation, JsonSchema, TagGroup } from '../lib/client-types'
import { blurActive } from '../lib/focus'
import { setInsertMode } from '../lib/form-mode'
import { confirmForm, exitInsert, insertCurrentInput, isTypingInCurrentField, moveFormTab, selectDefaultInput } from '../lib/form-nav'
import { commandHotkey } from '../lib/keys'
import { asRecord } from '../lib/build-request'
import { repeatHotkey, useRepeatDelta, useTrailingCommit } from '../lib/repeat'
import { inputClass } from '../lib/ui'

type Search = {
  op?: string
  q?: string
}

export const Route = createFileRoute('/apis/$apiId')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    op: typeof search.op === 'string' ? search.op : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  loader: async ({ params }) => getApi({ data: { id: params.apiId } }),
  component: ApiClientPage,
})

function matches(operation: ClientOperation, query: string) {
  if (!query) {
    return true
  }

  const haystack = [
    operation.id,
    operation.method,
    operation.path,
    operation.summary ?? '',
    operation.description ?? '',
    ...operation.tags,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function oneLine(value?: string) {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text || undefined
}

function groupOperations(operations: ClientOperation[], tagGroups: TagGroup[]) {
  const buckets = new Map<string, ClientOperation[]>()
  const untagged: ClientOperation[] = []

  for (const operation of operations) {
    const name = operation.tags[0]
    if (!name) {
      untagged.push(operation)
      continue
    }
    const bucket = buckets.get(name) ?? []
    bucket.push(operation)
    buckets.set(name, bucket)
  }

  const groups: Array<{ name?: string; description?: string; operations: ClientOperation[] }> =
    []

  for (const tag of tagGroups) {
    const items = buckets.get(tag.name)
    if (!items || items.length === 0) {
      continue
    }
    groups.push({
      name: tag.name,
      description: tag.description,
      operations: items,
    })
    buckets.delete(tag.name)
  }

  for (const [name, items] of buckets) {
    groups.push({ name, operations: items })
  }

  if (untagged.length > 0) {
    groups.push({ operations: untagged })
  }

  return groups
}

function hasAuthFields(schema: JsonSchema | undefined) {
  return Object.keys(asRecord(schema?.properties)).length > 0
}

function ApiClientPage() {
  const api = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const needsAuth = hasAuthFields(api.authSchema)
  const [editing, setEditing] = useState(false)
  const showAuth = Boolean(needsAuth && api.authSchema && (!api.authStored || editing))

  useHotkeys([
    {
      hotkey: 'N',
      callback: () => {
        void navigate({ to: '/' })
      },
    },
  ])

  if (showAuth && api.authSchema) {
    return (
      <AuthStep
        title={api.title}
        schema={api.authSchema}
        uiSchema={api.authUiSchema ?? {}}
        stored={Boolean(api.authStored)}
        onContinue={async (value) => {
          await saveApiAuth({
            data: { apiId: api.id, fields: fieldsFromForm(value) },
          })
          setEditing(false)
          await router.invalidate()
        }}
        onLeave={() => {
          if (api.authStored) {
            setEditing(false)
            return
          }
          void navigate({ to: '/' })
        }}
      />
    )
  }

  return (
    <ApiWorkbench
      api={api}
      onEditAuth={
        needsAuth
          ? () => {
              setEditing(true)
            }
          : undefined
      }
    />
  )
}

function ApiWorkbench({
  api,
  onEditAuth,
}: {
  api: ClientApi
  onEditAuth?: () => void
}) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const home = useNavigate()
  const [serverUrl, setServerUrl] = useState(api.servers[0] ?? '')
  const [filterOpen, setFilterOpen] = useState(Boolean(search.q))
  const [pane, setPane] = useState<'list' | 'form'>(search.op ? 'form' : 'list')
  const [heldOp, setHeldOp] = useState(search.op)
  const heldOpRef = useRef(search.op)
  const paneRef = useRef(pane)
  paneRef.current = pane
  useEffect(() => {
    if (pane === 'list') {
      setInsertMode(false)
    }
  }, [pane])

  const visible = useMemo(
    () => api.operations.filter((operation) => matches(operation, search.q ?? '')),
    [api.operations, search.q],
  )
  const groups = useMemo(
    () => groupOperations(visible, api.tagGroups ?? []),
    [api.tagGroups, visible],
  )
  const selected =
    visible.find((operation) => operation.id === (heldOp ?? search.op)) ?? visible[0]
  const manyServers = api.servers.length > 1

  const opCommit = useTrailingCommit((id: string) => {
    void navigate({
      search: (previous) => ({ ...previous, op: id }),
      replace: true,
    })
  })

  useEffect(() => {
    heldOpRef.current = search.op
    setHeldOp(search.op)
  }, [search.op])

  function move(delta: number) {
    if (visible.length === 0) {
      return
    }
    if (paneRef.current !== 'list') {
      blurActive()
      setPane('list')
    }
    const currentId = heldOpRef.current ?? selected?.id
    const current = visible.findIndex((item) => item.id === currentId)
    const start = current === -1 ? 0 : current
    const next = visible[(start + delta + visible.length) % visible.length]
    if (!next) {
      return
    }
    heldOpRef.current = next.id
    setHeldOp(next.id)
    document.getElementById(`op-${next.id}`)?.scrollIntoView({ block: 'nearest' })
    opCommit.set(next.id)
  }

  function stepBack() {
    if (filterOpen) {
      setFilterOpen(false)
      void navigate({
        search: (previous) => ({ ...previous, q: undefined }),
        replace: true,
      })
      return
    }
    if (pane === 'form') {
      setPane('list')
      blurActive()
      return
    }
    void home({ to: '/' })
  }

  function cycleServer(delta: number) {
    if (!manyServers) {
      return
    }
    const current = api.servers.indexOf(serverUrl)
    const index = current === -1 ? 0 : current
    const next = api.servers[(index + delta + api.servers.length) % api.servers.length]
    if (next) {
      setServerUrl(next)
    }
  }

  const nudge = useRepeatDelta((delta) => {
    if (paneRef.current === 'form') {
      moveFormTab('call-form', delta)
      return
    }
    move(delta)
  })

  useHotkeys([
    {
      hotkey: '/',
      callback: () => {
        setFilterOpen(true)
        window.setTimeout(() => {
          document.getElementById('operation-filter')?.focus()
        }, 0)
      },
    },
    {
      hotkey: 'J',
      callback: () => {
        nudge(1)
      },
      options: repeatHotkey,
    },
    {
      hotkey: 'K',
      callback: () => {
        nudge(-1)
      },
      options: repeatHotkey,
    },
    {
      hotkey: { key: 'Tab' },
      callback: () => {
        nudge(1)
      },
      options: { enabled: pane === 'form' },
    },
    {
      hotkey: { key: 'Tab', shift: true },
      callback: () => {
        nudge(-1)
      },
      options: { enabled: pane === 'form' },
    },
    {
      hotkey: 'Enter',
      callback: (event) => {
        if (paneRef.current === 'form') {
          if (document.activeElement instanceof HTMLTextAreaElement) {
            return
          }
          event.preventDefault()
          confirmForm('call-form')
          return
        }
        event.preventDefault()
        opCommit.flush()
        if (selected) {
          setPane('form')
          window.setTimeout(() => selectDefaultInput('call-form'), 0)
        }
      },
      options: commandHotkey,
    },
    {
      hotkey: 'I',
      callback: (event) => {
        if (paneRef.current === 'form') {
          if (isTypingInCurrentField('call-form')) {
            return
          }
          event.preventDefault()
          insertCurrentInput('call-form')
          return
        }
        event.preventDefault()
        if (selected) {
          setPane('form')
        }
      },
      options: commandHotkey,
    },
    {
      hotkey: 'Escape',
      callback: (event) => {
        event.preventDefault()
        if (exitInsert('call-form')) {
          return
        }
        stepBack()
      },
      options: commandHotkey,
    },
    {
      hotkey: 'Backspace',
      callback: () => {
        stepBack()
      },
    },
    {
      hotkey: '[',
      callback: () => cycleServer(-1),
      options: { enabled: manyServers },
    },
    {
      hotkey: ']',
      callback: () => cycleServer(1),
      options: { enabled: manyServers },
    },
  ])

  const hints = [
    { hotkey: '/', label: 'filter' },
    { hotkey: 'J', label: 'next' },
    { hotkey: 'K', label: 'previous' },
    { hotkey: 'Enter', label: pane === 'form' ? 'expand' : 'fields' },
    { hotkey: 'I', label: 'insert' },
    { hotkey: 'Mod+Enter', label: 'send' },
    { hotkey: 'Backspace', label: 'back' },
    { hotkey: 'Escape', label: pane === 'form' ? 'operations' : 'specs' },
    ...(manyServers
      ? [
          { hotkey: '[', label: 'previous server' },
          { hotkey: ']', label: 'next server' },
        ]
      : []),
    { hotkey: 'N', label: 'home' },
  ]

  return (
    <main id="main" className="flex h-full min-h-0 flex-col overflow-hidden bg-paper">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-rule px-3 py-2 md:px-4">
        <span className="min-w-0 truncate text-sm text-ink">{api.title}</span>
        {manyServers ? (
          <>
            <label htmlFor="server-url" className="sr-only">
              Server
            </label>
            <input
              id="server-url"
              name="server-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} max-w-xl flex-1`}
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
            />
          </>
        ) : null}
        {onEditAuth ? (
          <button
            type="button"
            className="ml-auto text-sm text-mute hover:text-ink"
            onClick={onEditAuth}
          >
            Auth
          </button>
        ) : null}
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          selected && pane === 'form'
            ? 'lg:grid-cols-[17rem_minmax(0,1fr)]'
            : ''
        }`}
      >
        <aside
          className={`flex min-h-0 flex-col border-rule ${
            pane === 'form' ? 'hidden lg:flex lg:border-r' : 'flex'
          }`}
        >
          {filterOpen ? (
            <div className="shrink-0 p-3">
              <label htmlFor="operation-filter" className="sr-only">
                Filter operations
              </label>
              <input
                id="operation-filter"
                name="operation-filter"
                type="search"
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
                value={search.q ?? ''}
                onChange={(event) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      q: event.target.value || undefined,
                    }),
                    replace: true,
                  })
                }
                placeholder="Filter"
              />
            </div>
          ) : null}

          <nav aria-label="Operations" className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-3 py-3 text-sm text-mute">No matches.</p>
            ) : (
              groups.map((group) => {
                const title = oneLine(group.name)
                const groupDescription = oneLine(group.description)
                return (
                  <section key={group.name ?? 'untagged'} className="pb-2">
                    {title ? (
                      <header className="px-3 pb-1 pt-3">
                        <p className="truncate text-[11px] text-mute">{title}</p>
                        {groupDescription ? (
                          <p className="truncate text-[11px] text-faint">
                            {groupDescription}
                          </p>
                        ) : null}
                      </header>
                    ) : null}
                    <ol>
                      {group.operations.map((operation) => {
                        const active = operation.id === selected?.id
                        const description = oneLine(
                          operation.summary ?? operation.description,
                        )
                        return (
                          <li key={operation.id}>
                            <Link
                              id={`op-${operation.id}`}
                              to="/apis/$apiId"
                              params={{ apiId: api.id }}
                              search={(previous) => ({
                                ...previous,
                                op: operation.id,
                              })}
                              onClick={() => setPane('form')}
                              onPointerEnter={() => {
                                if (pane !== 'list' || heldOpRef.current === operation.id) {
                                  return
                                }
                                heldOpRef.current = operation.id
                                setHeldOp(operation.id)
                                opCommit.set(operation.id)
                              }}
                              className={`flex min-h-10 min-w-0 items-baseline gap-3 px-3 py-2 outline-none focus-visible:text-signal ${
                                active ? 'bg-signal/10 text-ink' : 'text-mute'
                              }`}
                            >
                              <span
                                className={`w-12 shrink-0 font-mono text-xs tabular-nums ${
                                  active ? 'text-signal' : ''
                                }`}
                              >
                                {operation.method.toUpperCase()}
                              </span>
                              <span className="min-w-0 truncate font-mono text-xs">
                                {operation.path}
                              </span>
                              {description ? (
                                <span className="min-w-0 flex-1 truncate text-xs text-faint">
                                  {description}
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )
              })
            )}
          </nav>
        </aside>

        {selected && pane === 'form' ? (
          <OperationClient
            key={selected.id}
            api={api}
            operation={selected}
            serverUrl={serverUrl}
          />
        ) : null}
      </div>
      <HintBar items={hints} />
    </main>
  )
}
