import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, isNotFound, notFound, useNavigate } from '@tanstack/react-router'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Kbd } from '../components/hints'
import { McpServerPanel } from '../components/mcp-server-panel'
import { ExecutableClient } from '../components/operation-client'
import { QueryStatus } from '../components/query-status'
import { clearApiAuth, fieldsFromForm, saveApiAuth } from '../lib/auth'
import type {
  Executable,
  ExecutableGroup,
  ExecutableSource,
  JsonSchema,
} from '../lib/client-types'
import { apiQueryOptions } from '../lib/queries'
import { blurActive } from '../lib/focus'
import { useFormPaneNavigation } from '../lib/form-nav'
import { fuzzyScore } from '../lib/fuzzy'
import { consumePointerIntent, usePaneActions, usePaneFlags, useStepKeys } from '../lib/keys'
import { activate, enterEdit, getPane, usePane, type Pane } from '../lib/mode'
import { asRecord } from '../lib/build-request'
import { inputClass } from '../lib/ui'
import { subscribeMcpChanges } from '../lib/mcp/client'

type Search = {
  q?: string
}

export const Route = createFileRoute('/apis/$apiId/$pane/{-$operationId}')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: ApiClientPage,
})

type WorkbenchPane = Exclude<Pane, 'specs'>

function readPane(value: string, operationId?: string): WorkbenchPane {
  if (value === 'routes' && !operationId) {
    return value
  }
  if ((value === 'input' || value === 'response') && operationId) {
    return value
  }
  throw notFound()
}

function operationQueryText(operation: Executable) {
  return [
    operation.badge,
    operation.name,
    operation.id,
    ...operation.groups,
    operation.summary ?? '',
    operation.description ?? '',
  ].join(' ')
}

function oneLine(value?: string) {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text || undefined
}

function groupOperations(operations: Executable[], tagGroups: ExecutableGroup[]) {
  const buckets = new Map<string, Executable[]>()
  const untagged: Executable[] = []

  for (const operation of operations) {
    const name = operation.groups[0]
    if (!name) {
      untagged.push(operation)
      continue
    }
    const bucket = buckets.get(name) ?? []
    bucket.push(operation)
    buckets.set(name, bucket)
  }

  const groups: Array<{
    name?: string
    description?: string
    operations: Executable[]
  }> = []

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

  const saveAuth = useMutation({
    mutationFn: async (value: Record<string, unknown>) => {
      saveApiAuth(apiId, fieldsFromForm(value))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiQueryOptions(apiId).queryKey,
      })
    },
  })

  const clearAuth = useMutation({
    mutationFn: async () => {
      clearApiAuth(apiId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiQueryOptions(apiId).queryKey,
      })
    },
  })

  if (apiQuery.isPending) {
    return <QueryStatus label="Reading the source…" />
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
  const canAuth = hasAuthFields(api.credentialSchema)
  const needsAuth = Boolean(
    canAuth && api.credentialsRequired !== false && !api.credentialsStored,
  )

  return (
    <ApiWorkbench
      api={api}
      needsAuth={needsAuth}
      onClearAuth={
        canAuth && api.credentialsStored
          ? async () => {
              await clearAuth.mutateAsync()
            }
          : undefined
      }
      onSaveAuth={async (value) => {
        await saveAuth.mutateAsync(value)
      }}
      authPending={saveAuth.isPending || clearAuth.isPending}
      authError={saveAuth.error ?? clearAuth.error}
    />
  )
}

function ApiWorkbench({
  api,
  needsAuth,
  onClearAuth,
  onSaveAuth,
  authPending,
  authError,
}: {
  api: ExecutableSource
  needsAuth: boolean
  onClearAuth?: () => Promise<void>
  onSaveAuth: (value: Record<string, unknown>) => Promise<void>
  authPending: boolean
  authError: unknown
}) {
  const { operationId, pane: paneParam } = Route.useParams()
  const routePane = readPane(paneParam, operationId)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const home = useNavigate()
  const queryClient = useQueryClient()
  const activePane = usePane()
  const [serverUrl, setServerUrl] = useState(api.targets[0] ?? '')
  const [filterValue, setFilterValue] = useState(search.q ?? '')
  const deferredFilterValue = useDeferredValue(filterValue)
  const committedFilterRef = useRef(search.q ?? '')
  const [heldOp, setHeldOp] = useState(operationId)
  const heldOpRef = useRef(operationId)
  const localOpRef = useRef(false)
  useEffect(() => {
    activate(routePane, 'command')
  }, [api.id, routePane])

  useEffect(() => {
    if (api.kind !== 'mcp') {
      return
    }
    return subscribeMcpChanges(api.id, () => {
      void queryClient.invalidateQueries({
        queryKey: apiQueryOptions(api.id).queryKey,
      })
    })
  }, [api.id, api.kind, queryClient])

  useEffect(() => {
    const routeFilter = search.q ?? ''
    if (routeFilter !== committedFilterRef.current) {
      committedFilterRef.current = routeFilter
      setFilterValue(routeFilter)
    }
  }, [search.q])

  useEffect(() => {
    const routeFilter = search.q ?? ''
    if (filterValue === routeFilter) {
      committedFilterRef.current = routeFilter
      return
    }
    const timer = window.setTimeout(() => {
      committedFilterRef.current = filterValue
      void navigate({
        search: (previous) => ({
          ...previous,
          q: filterValue || undefined,
        }),
        replace: true,
        resetScroll: false,
      })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [filterValue, navigate, search.q])

  const ranked = useMemo(() => {
    const query = deferredFilterValue.trim()
    if (!query) {
      return undefined
    }
    return api.executables
      .map((operation) => ({
        operation,
        score: fuzzyScore(operationQueryText(operation), query),
      }))
      .filter((item) => item.score != null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((item) => item.operation)
  }, [api.executables, deferredFilterValue])
  const groups = useMemo(
    () => (ranked ? [] : groupOperations(api.executables, api.groups ?? [])),
    [api.executables, api.groups, ranked],
  )
  const orderedOperations = useMemo(
    () => ranked ?? groups.flatMap((group) => group.operations),
    [groups, ranked],
  )
  const operationIndexById = useMemo(
    () => new Map(orderedOperations.map((operation, index) => [operation.id, index])),
    [orderedOperations],
  )
  const requestedIndex = operationIndexById.get(heldOp ?? operationId ?? '')
  const selectedIndex = requestedIndex ?? (orderedOperations.length > 0 ? 0 : -1)
  const selected = orderedOperations[selectedIndex]
  const manyServers = api.targets.length > 1

  useEffect(() => {
    if (!operationId) {
      localOpRef.current = false
      return
    }
    if (localOpRef.current) {
      if (operationId === heldOpRef.current) {
        localOpRef.current = false
      }
      return
    }
    heldOpRef.current = operationId
    setHeldOp(operationId)
  }, [operationId])

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
    if (getPane() !== 'routes') {
      blurActive()
      activate('routes', 'command')
    }
    const currentId = heldOpRef.current ?? selected?.id
    const current = currentId ? (operationIndexById.get(currentId) ?? -1) : -1
    const start = current === -1 ? 0 : current
    const next =
      orderedOperations[Math.min(Math.max(start + delta, 0), orderedOperations.length - 1)]
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
  }, [deferredFilterValue])

  function focusFilter() {
    activate('routes', 'edit')
    document.getElementById('operation-filter')?.focus()
  }

  function openSelected() {
    if (!selected) {
      return
    }
    holdOp(selected.id)
    activate('input', 'command')
    void navigate({
      to: '/apis/$apiId/$pane/{-$operationId}',
      params: { apiId: api.id, pane: 'input', operationId: selected.id },
      resetScroll: false,
    })
  }

  function navigateOperation(delta: number) {
    const next = orderedOperations[selectedIndex + delta]
    if (!next) {
      return
    }
    holdOp(next.id)
    activate('input', 'command')
    void navigate({
      to: '/apis/$apiId/$pane/{-$operationId}',
      params: { apiId: api.id, pane: 'input', operationId: next.id },
      replace: true,
      resetScroll: false,
    })
    revealOperation(next.id)
  }

  function stepBack() {
    if (getPane() === 'response') {
      const parentOperationId = heldOpRef.current ?? operationId
      if (!parentOperationId) {
        return
      }
      activate('input', 'command')
      void navigate({
        to: '/apis/$apiId/$pane/{-$operationId}',
        params: {
          apiId: api.id,
          pane: 'input',
          operationId: parentOperationId,
        },
        replace: true,
        resetScroll: false,
      })
      return
    }
    if (getPane() === 'input') {
      const parentOperationId = heldOpRef.current ?? operationId
      activate('routes', 'command')
      blurActive()
      void navigate({
        to: '/apis/$apiId/$pane/{-$operationId}',
        params: { apiId: api.id, pane: 'routes', operationId: undefined },
        replace: true,
        resetScroll: false,
      })
      if (parentOperationId) {
        window.setTimeout(() => {
          document.getElementById(`op-${parentOperationId}`)?.focus()
        }, 0)
      }
      return
    }
    void home({ to: '/' })
  }

  function cycleServer(delta: number) {
    if (!manyServers) {
      return
    }
    const current = api.targets.indexOf(serverUrl)
    const index = current === -1 ? 0 : current
    const next = api.targets[(index + delta + api.targets.length) % api.targets.length]
    if (next) {
      setServerUrl(next)
    }
  }

  const canClear = Boolean(onClearAuth)
  usePaneFlags('routes', {
    canClear,
    manyServers,
  })
  usePaneFlags('input', {
    canClear,
    canNextRoute: selectedIndex >= 0 && selectedIndex < orderedOperations.length - 1,
    canPreviousRoute: selectedIndex > 0,
    manyServers,
  })
  useStepKeys('routes', move)
  useFormPaneNavigation('input', 'call-form')

  usePaneActions('routes', {
    filter: () => {
      focusFilter()
    },
    input: () => {
      openSelected()
    },
    clearAuth: {
      callback: () => {
        if (!authPending) {
          void onClearAuth?.()
        }
      },
      ignoreInputs: false,
    },
    parent: () => {
      stepBack()
    },
    prevServer: () => cycleServer(-1),
    nextServer: () => cycleServer(1),
    command: (event) => {
      event.preventDefault()
      blurActive()
      activate('routes', 'command')
    },
  })

  usePaneActions('input', {
    previousRoute: () => navigateOperation(-1),
    nextRoute: () => navigateOperation(1),
    clearAuth: {
      callback: () => {
        if (!authPending) {
          void onClearAuth?.()
        }
      },
      ignoreInputs: false,
    },
    parent: () => {
      stepBack()
    },
    prevServer: () => cycleServer(-1),
    nextServer: () => cycleServer(1),
  })

  function renderOperation(operation: Executable) {
    const active = operation.id === selected?.id
    const index = operationIndexById.get(operation.id) ?? -1
    const navigationHint =
      activePane !== 'routes'
        ? undefined
        : active
          ? 'Enter'
          : index === selectedIndex - 1
            ? 'K'
            : index === selectedIndex + 1
              ? 'J'
              : undefined
    const description = oneLine(operation.summary ?? operation.description)
    return (
      <li key={operation.id}>
        <Link
          id={`op-${operation.id}`}
          to="/apis/$apiId/$pane/{-$operationId}"
          params={{ apiId: api.id, pane: 'input', operationId: operation.id }}
          resetScroll={false}
          onClick={() => {
            holdOp(operation.id)
            activate('input', 'command')
          }}
          onPointerEnter={() => {
            if (!consumePointerIntent()) {
              return
            }
            if (activePane !== 'routes') {
              blurActive()
              activate('routes', 'command')
            }
            if (heldOpRef.current !== operation.id) {
              holdOp(operation.id)
            }
          }}
          data-oc-executable
          data-oc-active={active || undefined}
          className="flex min-h-10 min-w-0 items-baseline gap-3 px-3 py-2 text-mute outline-none"
          style={{ '--exec-color': operation.accent } as CSSProperties}
        >
          <span className="inline-flex w-8 shrink-0 justify-end">
            {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
          </span>
          <span data-oc-executable-badge className="w-12 shrink-0 font-mono text-xs tabular-nums">
            {operation.badge}
          </span>
          <span className="min-w-0 truncate font-mono text-xs">{operation.name}</span>
          {description ? (
            <span className="min-w-0 flex-1 truncate text-xs text-faint">{description}</span>
          ) : null}
        </Link>
      </li>
    )
  }

  return (
    <main id="main" className="flex h-full min-h-0 flex-col overflow-hidden bg-paper">
      <div className="shrink-0 border-b border-rule">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 md:px-4">
          <span className="min-w-0 truncate text-sm text-ink">{api.title}</span>
          {manyServers ? (
            <div className="flex min-w-0 max-w-xl flex-1 items-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-9 w-9 shrink-0 items-center justify-center bg-ink/10 hover:bg-ink/15"
                aria-label={`Previous ${api.labels.target}`}
                onClick={() => cycleServer(-1)}
              >
                <Kbd hotkey="[" />
              </button>
              <label htmlFor="server-url" className="sr-only">
                {api.labels.target}
              </label>
              <input
                id="server-url"
                name="server-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} min-w-0 flex-1`}
                value={serverUrl}
                onFocus={() => {
                  enterEdit()
                }}
                onChange={(event) => setServerUrl(event.target.value)}
              />
              <button
                type="button"
                className="inline-flex min-h-9 w-9 shrink-0 items-center justify-center bg-ink/10 hover:bg-ink/15"
                aria-label={`Next ${api.labels.target}`}
                onClick={() => cycleServer(1)}
              >
                <Kbd hotkey="]" />
              </button>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink"
              onClick={stepBack}
            >
              {activePane === 'response'
                ? 'Input'
                : activePane === 'input'
                  ? api.labels.executablePlural
                  : api.labels.sourcePlural}
              <Kbd hotkey="Escape" />
            </button>
            {onClearAuth ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink disabled:opacity-40"
                disabled={authPending}
                onClick={() => {
                  void onClearAuth()
                }}
              >
                Clear credentials
                <Kbd hotkey="Mod+Backspace" />
              </button>
            ) : null}
          </div>
        </div>
        <McpServerPanel source={api} />
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          selected && (activePane === 'input' || activePane === 'response')
            ? 'lg:grid-cols-[17rem_minmax(0,1fr)]'
            : ''
        }`}
      >
        <aside
          className={`flex min-h-0 flex-col border-rule ${
            activePane === 'input' || activePane === 'response'
              ? 'hidden lg:flex lg:border-r'
              : 'flex'
          }`}
        >
          <div className="shrink-0 px-3 py-2">
            <div className="relative w-full max-w-[26rem]">
              <label htmlFor="operation-filter" className="sr-only">
                Filter {api.labels.executablePlural}
              </label>
              <input
                id="operation-filter"
                name="operation-filter"
                type="search"
                autoComplete="off"
                spellCheck={false}
                className={`min-h-9 w-full appearance-none bg-ink/10 px-2.5 text-sm text-ink outline-none placeholder:text-mute ${
                  filterValue ? 'pr-16' : 'pr-9'
                }`}
                value={filterValue}
                onFocus={() => {
                  activate('routes', 'edit')
                }}
                onChange={(event) => setFilterValue(event.target.value)}
                placeholder={`Filter ${api.labels.executablePlural}`}
              />
              {filterValue ? (
                <button
                  type="button"
                aria-label={`Clear ${api.labels.executable} filter`}
                  className="absolute inset-y-0 right-8 inline-flex w-9 items-center justify-center text-mute hover:text-ink focus-visible:text-ink"
                  onClick={() => {
                    setFilterValue('')
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
              ) : null}
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <Kbd hotkey="/" />
              </span>
            </div>
          </div>
          <nav
            aria-label={api.labels.executablePlural}
            data-operation-list
            className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
          >
            {orderedOperations.length === 0 ? (
              <p className="px-3 py-3 text-sm text-mute">No matches.</p>
            ) : ranked ? (
              <ol>{orderedOperations.map((operation) => renderOperation(operation))}</ol>
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
                          <p className="truncate text-[11px] text-faint">{groupDescription}</p>
                        ) : null}
                      </header>
                    ) : null}
                    <ol>{group.operations.map((operation) => renderOperation(operation))}</ol>
                  </section>
                )
              })
            )}
          </nav>
        </aside>

        {selected && (activePane === 'input' || activePane === 'response') ? (
          <ExecutableClient
            key={selected.id}
            api={api}
            operation={selected}
            target={serverUrl}
            needsAuth={needsAuth}
            authSchema={api.credentialSchema}
            authUiSchema={api.credentialUiSchema}
            authPending={authPending}
            authError={authError}
            onPreviousOperation={selectedIndex > 0 ? () => navigateOperation(-1) : undefined}
            onNextOperation={
              selectedIndex >= 0 && selectedIndex < orderedOperations.length - 1
                ? () => navigateOperation(1)
                : undefined
            }
            onSaveAuth={onSaveAuth}
          />
        ) : null}
      </div>
    </main>
  )
}
