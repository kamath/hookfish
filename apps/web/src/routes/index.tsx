import { useEffect, useRef, useState } from 'react'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { AuthRedirect } from '../components/auth-status'
import { KeyHints, Kbd } from '../components/hints'
import { QueryMessage } from '../components/query-status'
import { addApi, removeApi } from '../lib/apis'
import {
  CATALOG,
  MCP_CATALOG,
  OPENAPI_CATALOG,
  catalogActionId,
  sourceUrlKey,
  type CatalogEntry,
} from '../lib/catalog'
import { blurActive } from '../lib/focus'
import { apisQueryOptions, queryErrorMessage } from '../lib/queries'
import {
  sourceSubmitActionId,
  usePaneActions,
  usePaneFlags,
  useShowKeybindings,
  useStepKeys,
} from '../lib/keys'
import { activate, enterCommand } from '../lib/mode'
import { pendingMcpAuthorization, clearPendingMcpAuthorization } from '../lib/mcp/oauth'
import { sourceAdapterOptions } from '../lib/source-adapters'
import { primaryButtonClass, softButtonClass, softInputClass } from '../lib/ui'

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home,
})

type PendingAuth = {
  href: string
  sourceId: string
  entryId?: string
}

type OpenSource = {
  url: string
  kind: string
  entryId?: string
}

function Home() {
  const apisQuery = useQuery(apisQueryOptions)
  const queryClient = useQueryClient()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState(0)
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | undefined>(() => {
    const pending = pendingMcpAuthorization()
    return pending
      ? { href: pending.url, sourceId: pending.sourceId }
      : undefined
  })
  const sourceOptions = sourceAdapterOptions()
  const apis = apisQuery.data ?? []
  const showKeybindings = useShowKeybindings()

  const openSource = useMutation({
    mutationFn: async ({ url: sourceUrl, kind }: OpenSource) => {
      const key = sourceUrlKey(sourceUrl)
      const existing = apis.find(
        (api) => api.kind === kind && sourceUrlKey(api.sourceUrl) === key,
      )
      return existing ? { id: existing.id } : addApi(sourceUrl, kind)
    },
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({
        queryKey: apisQueryOptions.queryKey,
      })
      setUrl('')
      await router.navigate({
        to: '/apis/$apiId/$pane/{-$operationId}',
        params: { apiId: id, pane: 'routes', operationId: undefined },
      })
    },
    onError: (error, variables) => {
      if (UnauthorizedError.isInstance(error)) {
        const next = pendingMcpAuthorization()
        if (next) {
          enterCommand()
          blurActive()
          setPendingAuth({
            href: next.url,
            sourceId: next.sourceId,
            entryId: variables.entryId,
          })
          return
        }
      }
      if (!variables.entryId) {
        urlRef.current?.focus()
      }
    },
  })
  const compactLauncher = showKeybindings && !openSource.isPending

  const remove = useMutation({
    mutationFn: async (id: string) => {
      removeApi(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apisQueryOptions.queryKey,
      })
    },
  })

  useEffect(() => {
    activate('specs', 'command')
  }, [])

  function move(delta: number) {
    setSelected((index) => {
      const last = Math.max(apis.length - 1, 0)
      return Math.min(Math.max(index + delta, 0), last)
    })
  }

  function continueAuthorization() {
    if (!pendingAuth) {
      return
    }
    window.location.assign(pendingAuth.href)
  }

  function cancelAuthorization() {
    const sourceId = pendingAuth?.sourceId
    setPendingAuth(undefined)
    openSource.reset()
    clearPendingMcpAuthorization()
    if (sourceId) {
      removeApi(sourceId)
      void queryClient.invalidateQueries({
        queryKey: apisQueryOptions.queryKey,
      })
    }
  }

  function submit(kind: string) {
    if (openSource.isPending || !formRef.current?.reportValidity()) {
      return
    }
    if (pendingAuth) {
      cancelAuthorization()
    }
    openSource.mutate({ url: url.trim(), kind })
  }

  function launch(entry: CatalogEntry) {
    if (openSource.isPending) {
      return
    }
    if (pendingAuth) {
      cancelAuthorization()
    }
    openSource.mutate({ url: entry.url, kind: entry.kind, entryId: entry.id })
  }

  usePaneFlags('specs', {
    hasSpecs: apis.length > 0,
    hasAuthRedirect: Boolean(pendingAuth),
  })
  useStepKeys('specs', move, apis.length > 0 && !pendingAuth)
  usePaneActions('specs', {
    ...Object.fromEntries(
      CATALOG.map((entry) => [
        catalogActionId(entry),
        { callback: () => launch(entry), enabled: !pendingAuth },
      ]),
    ),
    open: {
      callback: () => {
        const api = apis[selected]
        if (api) {
          void router.navigate({
            to: '/apis/$apiId/$pane/{-$operationId}',
            params: { apiId: api.id, pane: 'routes', operationId: undefined },
          })
        }
      },
      enabled: !pendingAuth && apis.length > 0,
    },
    continueAuth: continueAuthorization,
    cancelAuth: cancelAuthorization,
    insert: {
      callback: () => {
        activate('specs', 'edit')
        urlRef.current?.focus()
      },
      enabled: !pendingAuth,
    },
    ...Object.fromEntries(
      sourceOptions.map((option) => [
        sourceSubmitActionId(option.kind),
        { callback: () => submit(option.kind), enabled: !pendingAuth, ignoreInputs: false },
      ]),
    ),
    command: () => {
      enterCommand()
      blurActive()
    },
  })

  function onRemove(id: string, title: string) {
    if (!window.confirm(`Remove ${title}?`)) {
      return
    }
    remove.mutate(id)
  }

  function entryStatus(entry: CatalogEntry) {
    if (openSource.variables?.entryId === entry.id) {
      if (openSource.isPending) {
        return { message: 'Opening…', failed: false }
      }
      if (openSource.isError) {
        return {
          message: queryErrorMessage(openSource.error, 'Could not open that source.'),
          failed: true,
        }
      }
    }
    return { message: undefined, failed: false }
  }

  function renderCatalog(title: string, entries: readonly CatalogEntry[]) {
    return (
      <section className="bg-ink/5 pb-2">
        <h2 className="px-3 pb-1 pt-3 font-mono text-[11px] text-mute">{title}</h2>
        <ul>
          {entries.map((entry) => {
            const status = entryStatus(entry)
            const added = apis.some(
              (api) =>
                api.kind === entry.kind &&
                sourceUrlKey(api.sourceUrl) === sourceUrlKey(entry.url),
            )
            return (
              <li key={entry.id}>
                {pendingAuth?.entryId === entry.id ? (
                  <div className="bg-signal/10 px-3 py-2">
                    <div className="flex items-center gap-3">
                      {showKeybindings ? (
                        <span className="inline-flex w-4 shrink-0 justify-center">
                          <Kbd hotkey={entry.hotkey} />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{entry.title}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-ink/10 focus-visible:bg-ink/10 disabled:opacity-50"
                    disabled={openSource.isPending || Boolean(pendingAuth)}
                    onClick={() => launch(entry)}
                  >
                    {showKeybindings ? (
                      <span className="inline-flex w-4 shrink-0 justify-center">
                        <Kbd hotkey={entry.hotkey} />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{entry.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-faint">
                        {entry.detail}
                      </span>
                      {status.message ? (
                        <span
                          role={status.failed ? 'alert' : undefined}
                          className={`mt-1 block truncate font-mono text-xs ${
                            status.failed ? 'text-error' : 'text-mute'
                          }`}
                        >
                          {status.message}
                        </span>
                      ) : null}
                    </span>
                    {added ? (
                      <span className="shrink-0 font-mono text-[11px] text-faint">added</span>
                    ) : null}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <main id="main" className="relative flex h-full min-h-0 flex-col overflow-y-auto px-3 md:px-4">
      <div className="mx-auto my-auto w-full max-w-3xl py-10">
        <form
          ref={formRef}
          data-oc-enter-submit="true"
          onSubmit={(event) => {
            event.preventDefault()
          }}
          className={
            compactLauncher
              ? 'mx-auto w-full max-w-xl'
              : 'flex w-full flex-col gap-3 sm:flex-row sm:items-start'
          }
        >
          <label htmlFor="url" className="sr-only">
            MCP endpoint or OpenAPI document URL
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              ref={urlRef}
              id="url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={openSource.isPending || Boolean(pendingAuth)}
              className={`${softInputClass} ${showKeybindings ? 'pl-10' : ''}`}
              placeholder="MCP URL or link to OpenAPI JSON/YAML"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onFocus={() => {
                activate('specs', 'edit')
              }}
            />
            {showKeybindings ? (
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <Kbd hotkey="I" />
              </span>
            ) : null}
          </div>
          {compactLauncher ? null : (
            <div className="flex shrink-0 gap-2">
              {sourceOptions.map((option, index) => {
                const pending =
                  openSource.isPending &&
                  !openSource.variables?.entryId &&
                  openSource.variables?.kind === option.kind
                return (
                  <button
                    key={option.kind}
                    type="button"
                    className={index === 0 ? primaryButtonClass : softButtonClass}
                    disabled={openSource.isPending || Boolean(pendingAuth)}
                    onClick={() => submit(option.kind)}
                  >
                    {pending ? 'Reading…' : option.label}
                    {showKeybindings ? null : <Kbd hotkey={option.submitHotkey} persistent />}
                  </button>
                )
              })}
            </div>
          )}
        </form>
        {openSource.isError && !openSource.variables?.entryId && !pendingAuth ? (
          <p
            className={`mt-3 line-clamp-3 break-words text-sm text-error ${
              compactLauncher ? 'mx-auto max-w-xl' : ''
            }`}
            role="alert"
          >
            {queryErrorMessage(openSource.error, 'Could not read that source.')}
          </p>
        ) : null}

        <div className="mt-6 space-y-6">
          {apisQuery.isPending ? (
            <QueryMessage label="Loading sources…" />
          ) : apisQuery.isError ? (
            <QueryMessage
              error={apisQuery.error}
              onRetry={() => {
                void apisQuery.refetch()
              }}
            />
          ) : apis.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 px-3 pb-1 font-mono text-[11px] text-mute">
                <h2>Recent</h2>
                {pendingAuth || !showKeybindings ? null : (
                  <KeyHints className="flex items-center gap-2 text-faint">
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Kbd hotkey="Enter" /> to open
                    </span>
                  </KeyHints>
                )}
              </div>
              <ul>
                {apis.map((api, index) => {
                  const active = index === selected
                  const navigationHint =
                    index === selected - 1 ? 'K' : index === selected + 1 ? 'J' : undefined
                  return (
                    <li
                      key={api.id}
                      className={`flex items-center gap-3 px-3 ${active ? 'bg-signal/10' : ''}`}
                    >
                      <Link
                        to="/apis/$apiId/$pane/{-$operationId}"
                        params={{
                          apiId: api.id,
                          pane: 'routes',
                          operationId: undefined,
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 py-2 outline-none focus-visible:text-signal"
                        onFocus={() => setSelected(index)}
                      >
                        {showKeybindings && navigationHint ? (
                          <span className="inline-flex w-4 shrink-0 justify-center">
                            <Kbd hotkey={navigationHint} />
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{api.title}</span>
                          <span className="mt-0.5 block truncate font-mono text-xs text-faint">
                            {api.kind} · {api.executableCount} executables
                            {api.version ? ` · ${api.version}` : ''}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="min-h-11 px-2 text-sm text-mute hover:text-signal"
                        onClick={() => onRemove(api.id, api.title)}
                        disabled={remove.isPending}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
          {remove.isError ? (
            <p className="text-sm text-error" role="alert">
              {queryErrorMessage(remove.error, 'Could not remove that source.')}
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {renderCatalog('MCP servers', MCP_CATALOG)}
            {renderCatalog('OpenAPI specs', OPENAPI_CATALOG)}
          </div>
        </div>
      </div>
      {pendingAuth ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper">
          <AuthRedirect href={pendingAuth.href} onCancel={cancelAuthorization} />
        </div>
      ) : null}
    </main>
  )
}
