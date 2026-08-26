import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, isNotFound, notFound, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthStep } from '../components/auth-step'
import { HintBar, Kbd } from '../components/hints'
import { OperationClient } from '../components/operation-client'
import { QueryStatus } from '../components/query-status'
import { clearApiAuth, fieldsFromForm, saveApiAuth } from '../lib/auth'
import type { ClientApi, ClientOperation, JsonSchema, TagGroup } from '../lib/client-types'
import { apiQueryOptions } from '../lib/queries'
import { blurActive } from '../lib/focus'
import {
  moveFormTab,
  selectDefaultInput,
  useFormPaneNavigation,
} from '../lib/form-nav'
import { fuzzyScore } from '../lib/fuzzy'
import { consumePointerIntent, usePaneHotkeys, useStepKeys } from '../lib/keys'
import { activate, enterEdit, getPane, useChrome, type Pane } from '../lib/mode'
import { asRecord } from '../lib/build-request'
import { inputClass } from '../lib/ui'

type Search = {
  op?: string
  q?: string
}

export const Route = createFileRoute('/apis/$apiId')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    op: typeof search.op === 'string' ? search.op : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: ApiClientPage,
})

function operationQueryText(operation: ClientOperation) {
  return [
    operation.method,
    operation.path,
    operation.id,
    ...operation.tags,
    operation.summary ?? '',
    operation.description ?? '',
  ].join(' ')
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
  const { apiId } = Route.useParams()
  const apiQuery = useQuery(apiQueryOptions(apiId))
  const queryClient = useQueryClient()
  const [authOpen, setAuthOpen] = useState(false)
  const [preserveForm, setPreserveForm] = useState(false)
  const returnPane = useRef<Pane>('list')

  function openAuth() {
    const pane = getPane()
    if (pane !== 'auth') {
      returnPane.current = pane
      setPreserveForm(pane === 'form' || pane === 'response')
    }
    setAuthOpen(true)
  }

  function closeAuth() {
    setAuthOpen(false)
    setPreserveForm(false)
    activate(returnPane.current, 'command')
  }

  const saveAuth = useMutation({
    mutationFn: async (value: Record<string, unknown>) => {
      saveApiAuth(apiId, fieldsFromForm(value))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiQueryOptions(apiId).queryKey })
    },
  })

  const clearAuth = useMutation({
    mutationFn: async () => {
      clearApiAuth(apiId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiQueryOptions(apiId).queryKey })
    },
  })

  if (apiQuery.isPending) {
    return <QueryStatus label="Reading the spec…" />
  }

  if (apiQuery.isError) {
    if (isNotFound(apiQuery.error)) {
      throw notFound()
    }
    return (
      <QueryStatus
        error={apiQuery.error}
        onRetry={() => {
          void apiQuery.refetch()
        }}
      />
    )
  }

  const api = apiQuery.data
  const canAuth = hasAuthFields(api.authSchema)
  const needsAuth = Boolean(canAuth && !api.authStored)

  return (
    <div className="relative h-full min-h-0">
      <ApiWorkbench
        api={api}
        authOpen={authOpen}
        preserveForm={preserveForm}
        needsAuth={needsAuth}
        onEditAuth={canAuth ? () => openAuth() : undefined}
        onSaveAuth={async (value) => {
          await saveAuth.mutateAsync(value)
        }}
        authPending={saveAuth.isPending || clearAuth.isPending}
        authError={saveAuth.error ?? clearAuth.error}
      />
      {authOpen && api.authSchema ? (
        <div className="absolute inset-0 z-20 bg-paper">
          <AuthStep
            title={api.title}
            schema={api.authSchema}
            uiSchema={api.authUiSchema ?? {}}
            stored={Boolean(api.authStored)}
            pending={saveAuth.isPending || clearAuth.isPending}
            error={saveAuth.error ?? clearAuth.error}
            onContinue={async (value) => {
              await saveAuth.mutateAsync(value)
              closeAuth()
            }}
            onClear={async () => {
              await clearAuth.mutateAsync()
              closeAuth()
            }}
            onLeave={closeAuth}
          />
        </div>
      ) : null}
    </div>
  )
}

function ApiWorkbench({
  api,
  authOpen,
  preserveForm,
  needsAuth,
  onEditAuth,
  onSaveAuth,
  authPending,
  authError,
}: {
  api: ClientApi
  authOpen: boolean
  preserveForm: boolean
  needsAuth: boolean
  onEditAuth?: () => void
  onSaveAuth: (value: Record<string, unknown>) => Promise<void>
  authPending: boolean
  authError: unknown
}) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const home = useNavigate()
  const { mode, pane } = useChrome()
  const [serverUrl, setServerUrl] = useState(api.servers[0] ?? '')
  const [heldOp, setHeldOp] = useState(search.op)
  const heldOpRef = useRef(search.op)
  const localOpRef = useRef(false)
  useEffect(() => {
    activate(search.op ? 'form' : 'list', 'command')
  }, [api.id])

  const ranked = useMemo(() => {
    const query = search.q?.trim() ?? ''
    if (!query) {
      return undefined
    }
    return api.operations
      .map((operation) => ({
        operation,
        score: fuzzyScore(operationQueryText(operation), query),
      }))
      .filter((item) => item.score != null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((item) => item.operation)
  }, [api.operations, search.q])
  const groups = useMemo(
    () =>
      ranked ? [] : groupOperations(api.operations, api.tagGroups ?? []),
    [api.operations, api.tagGroups, ranked],
  )
  const orderedOperations = useMemo(
    () => ranked ?? groups.flatMap((group) => group.operations),
    [groups, ranked],
  )
  const selected =
    orderedOperations.find((operation) => operation.id === (heldOp ?? search.op)) ??
    orderedOperations[0]
  const manyServers = api.servers.length > 1

  useEffect(() => {
    if (localOpRef.current) {
      if (search.op === heldOpRef.current) {
        localOpRef.current = false
      }
      return
    }
    heldOpRef.current = search.op
    setHeldOp(search.op)
  }, [search.op])

  function holdOp(id: string, fromKeys = false) {
    localOpRef.current = fromKeys
    heldOpRef.current = id
    setHeldOp(id)
  }

  function revealOperation(id: string) {
    const row = document.getElementById(`op-${id}`)
    const list = row?.closest<HTMLElement>('[data-operation-list]')
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

  function move(delta: number) {
    if (orderedOperations.length === 0) {
      return
    }
    if (getPane() !== 'list') {
      blurActive()
      activate('list', 'command')
    }
    const currentId = heldOpRef.current ?? selected?.id
    const current = orderedOperations.findIndex((item) => item.id === currentId)
    const start = current === -1 ? 0 : current
    const next =
      orderedOperations[
        Math.min(Math.max(start + delta, 0), orderedOperations.length - 1)
      ]
    if (!next) {
      return
    }
    holdOp(next.id, true)
    revealOperation(next.id)
  }

  useEffect(() => {
    const first = ranked?.[0]
    if (!first) {
      return
    }
    holdOp(first.id, true)
    revealOperation(first.id)
  }, [search.q])

  function focusFilter() {
    activate('list', 'edit')
    document.getElementById('operation-filter')?.focus()
  }

  function openSelected(insert: boolean) {
    if (!selected) {
      return
    }
    holdOp(selected.id)
    activate('form', 'command')
    void navigate({
      search: (previous) => ({ ...previous, op: selected.id }),
      replace: true,
      resetScroll: false,
    })
    if (insert) {
      window.setTimeout(() => selectDefaultInput('call-form'), 0)
    }
  }

  function stepBack() {
    if (getPane() === 'response') {
      activate('form', 'command')
      return
    }
    if (getPane() === 'form') {
      activate('list', 'command')
      blurActive()
      void navigate({
        search: (previous) => ({ ...previous, op: undefined }),
        replace: true,
        resetScroll: false,
      })
      return
    }
    if (search.q) {
      void navigate({
        search: (previous) => ({ ...previous, q: undefined }),
        replace: true,
        resetScroll: false,
      })
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

  function nudge(delta: number) {
    if (getPane() === 'form') {
      moveFormTab('call-form', delta)
      return
    }
    if (getPane() === 'response') {
      return
    }
    move(delta)
  }

  useStepKeys(nudge, pane !== 'response' && pane !== 'auth' && !authOpen)
  useFormPaneNavigation('form', 'call-form', { stepKeys: false })

  usePaneHotkeys('list', ['edit'], [
    {
      hotkey: 'Enter',
      callback: (event) => {
        if (document.activeElement?.id !== 'operation-filter' || !selected) {
          return
        }
        event.preventDefault()
        activate('list', 'command')
        blurActive()
        document.getElementById(`op-${selected.id}`)?.focus()
      },
      options: { ignoreInputs: false },
    },
    {
      hotkey: 'Escape',
      callback: (event) => {
        event.preventDefault()
        blurActive()
        activate('list', 'command')
      },
      options: { ignoreInputs: false },
    },
  ])

  usePaneHotkeys('list', ['command'], [
    {
      hotkey: '/',
      callback: () => {
        focusFilter()
      },
    },
    {
      hotkey: 'Enter',
      callback: () => {
        openSelected(true)
      },
    },
    {
      hotkey: 'I',
      callback: () => {
        openSelected(false)
      },
    },
    {
      hotkey: 'Escape',
      callback: () => {
        stepBack()
      },
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
    {
      hotkey: 'N',
      callback: () => {
        void home({ to: '/' })
      },
    },
    {
      hotkey: 'A',
      callback: () => {
        onEditAuth?.()
      },
      options: { enabled: Boolean(onEditAuth) },
    },
  ])

  usePaneHotkeys('form', ['command'], [
    {
      hotkey: 'Escape',
      callback: () => {
        stepBack()
      },
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
    {
      hotkey: 'N',
      callback: () => {
        void home({ to: '/' })
      },
    },
    {
      hotkey: 'A',
      callback: () => {
        onEditAuth?.()
      },
      options: { enabled: Boolean(onEditAuth) },
    },
  ])

  function renderOperation(operation: ClientOperation) {
    const active = operation.id === selected?.id
    const description = oneLine(operation.summary ?? operation.description)
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
          resetScroll={false}
          onClick={() => {
            holdOp(operation.id)
            activate('form', 'command')
          }}
          onPointerEnter={() => {
            if (
              pane !== 'list' ||
              heldOpRef.current === operation.id ||
              !consumePointerIntent()
            ) {
              return
            }
            holdOp(operation.id)
          }}
          data-oc-method={operation.method}
          data-oc-active={active || undefined}
          className={`api-${operation.method} flex min-h-10 min-w-0 items-baseline gap-3 px-3 py-2 text-mute outline-none focus-visible:text-signal`}
        >
          <span
            data-oc-method-label
            className="w-12 shrink-0 font-mono text-xs tabular-nums"
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
  }

  const serverHints = manyServers
    ? [
        { hotkey: '[', label: 'previous server' },
        { hotkey: ']', label: 'next server' },
      ]
    : []
  const authHint = onEditAuth ? [{ hotkey: 'A', label: 'auth' }] : []
  const sendHint = [{ hotkey: 'Mod+Enter', label: 'send' }]
  const hints =
    mode === 'edit'
      ? [
          { hotkey: 'Escape', label: 'command' },
          ...(pane === 'form' ? sendHint : []),
        ]
      : pane === 'form'
        ? [
            { hotkey: 'J', label: 'next' },
            { hotkey: 'K', label: 'previous' },
            { hotkey: 'I', label: 'insert' },
            { hotkey: 'Enter', label: 'expand' },
            ...sendHint,
            ...authHint,
            { hotkey: 'Escape', label: 'operations' },
            { hotkey: 'Backspace', label: 'back' },
            ...serverHints,
            { hotkey: 'N', label: 'home' },
          ]
        : pane === 'response'
          ? [
              { hotkey: 'J', label: 'next line' },
              { hotkey: 'K', label: 'previous line' },
              { hotkey: 'Tab', label: 'next line' },
              { hotkey: 'Enter', label: 'expand' },
              { hotkey: 'Mod+Enter', label: 'resend' },
              { hotkey: 'H', label: 'headers' },
              { hotkey: 'A', label: 'toggle children' },
              { hotkey: 'Escape', label: 'request' },
            ]
        : [
            { hotkey: '/', label: 'filter' },
            { hotkey: 'J', label: 'next' },
            { hotkey: 'K', label: 'previous' },
            { hotkey: 'Enter', label: 'fields' },
            { hotkey: 'I', label: 'fields' },
            ...authHint,
            {
              hotkey: 'Escape',
              label: search.q ? 'clear filter' : 'specs',
            },
            { hotkey: 'Backspace', label: search.q ? 'clear filter' : 'back' },
            ...serverHints,
            { hotkey: 'N', label: 'home' },
          ]

  return (
    <main id="main" className="flex h-full min-h-0 flex-col overflow-hidden bg-paper">
      <div className="shrink-0 border-b border-rule">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 md:px-4">
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
                onFocus={() => {
                  enterEdit()
                }}
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
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          selected && (pane === 'form' || pane === 'response')
            ? 'lg:grid-cols-[17rem_minmax(0,1fr)]'
            : ''
        }`}
      >
        <aside
          className={`flex min-h-0 flex-col border-rule ${
            pane === 'form' || pane === 'response' ? 'hidden lg:flex lg:border-r' : 'flex'
          }`}
        >
          <div className="shrink-0 px-3 py-2">
            <div className="relative w-full max-w-[26rem]">
              <label htmlFor="operation-filter" className="sr-only">
                Filter routes
              </label>
              <input
                id="operation-filter"
                name="operation-filter"
                type="search"
                autoComplete="off"
                spellCheck={false}
                className="min-h-9 w-full appearance-none bg-ink/10 px-2.5 pr-9 text-sm text-ink outline-none placeholder:text-mute"
                value={search.q ?? ''}
                onFocus={() => {
                  activate('list', 'edit')
                }}
                onChange={(event) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      q: event.target.value || undefined,
                    }),
                    replace: true,
                    resetScroll: false,
                  })
                }
                placeholder="Filter routes"
              />
              {search.q ? (
                <button
                  type="button"
                  aria-label="Clear route filter"
                  className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-mute hover:text-ink focus-visible:text-ink"
                  onClick={() => {
                    void navigate({
                      search: (previous) => ({ ...previous, q: undefined }),
                      replace: true,
                      resetScroll: false,
                    })
                    document.getElementById('operation-filter')?.focus()
                  }}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              ) : (
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <Kbd hotkey="/" />
                </span>
              )}
            </div>
          </div>
          <nav
            aria-label="Operations"
            data-operation-list
            className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
          >
            {orderedOperations.length === 0 ? (
              <p className="px-3 py-3 text-sm text-mute">No matches.</p>
            ) : ranked ? (
              <ol>
                {orderedOperations.map((operation) => renderOperation(operation))}
              </ol>
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
                      {group.operations.map((operation) => renderOperation(operation))}
                    </ol>
                  </section>
                )
              })
            )}
          </nav>
        </aside>

        {selected && (pane === 'form' || pane === 'response' || preserveForm) ? (
          <OperationClient
            key={selected.id}
            api={api}
            operation={selected}
            serverUrl={serverUrl}
            needsAuth={needsAuth}
            authSchema={api.authSchema}
            authUiSchema={api.authUiSchema}
            authPending={authPending}
            authError={authError}
            onSaveAuth={onSaveAuth}
          />
        ) : null}
      </div>
      <HintBar items={hints} />
    </main>
  )
}
