import { useEffect, useRef, useState } from 'react'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { AuthRedirect, finishPendingAuthRedirect } from '../components/auth-status'
import { Brand } from '../components/brand'
import { GITHUB_REPO_URL } from '../components/github-link'
import { KeyHints, Kbd } from '../components/hints'
import { QueryMessage, StatusPane } from '../components/query-status'
import { addApi, removeApi } from '../lib/apis'
import {
  CATALOG,
  MCP_CATALOG,
  OPENAPI_CATALOG,
  catalogActionId,
  catalogSourceUrl,
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
  const [urlFocused, setUrlFocused] = useState(false)
  const [selected, setSelected] = useState(0)
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | undefined>(() => {
    const pending = pendingMcpAuthorization()
    return pending
      ? { href: pending.url, sourceId: pending.sourceId }
      : undefined
  })
  const [pendingRemove, setPendingRemove] = useState<{ id: string; title: string }>()
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
  const submittingUrl = openSource.isPending && !openSource.variables?.entryId
  const showSubmitButtons = urlFocused || submittingUrl
  const urlError =
    openSource.isError && !openSource.variables?.entryId && !pendingAuth
      ? queryErrorMessage(openSource.error, 'Could not read that source.')
      : undefined
  const canStepDown = selected < apis.length - 1
  const canStepUp = selected > 0

  const remove = useMutation({
    mutationFn: async (id: string) => {
      removeApi(id)
    },
    onSuccess: async (_, id) => {
      setSelected((index) => {
        const removedIndex = apis.findIndex((api) => api.id === id)
        const last = Math.max(apis.length - 2, 0)
        if (removedIndex >= 0 && removedIndex < index) {
          return Math.min(index - 1, last)
        }
        return Math.min(index, last)
      })
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
    if (openSource.isPending || pendingRemove || !formRef.current?.reportValidity()) {
      return
    }
    if (pendingAuth) {
      cancelAuthorization()
    }
    openSource.mutate({ url: url.trim(), kind })
  }

  function launch(entry: CatalogEntry) {
    if (openSource.isPending || pendingRemove) {
      return
    }
    if (pendingAuth) {
      cancelAuthorization()
    }
    openSource.mutate({ url: catalogSourceUrl(entry), kind: entry.kind, entryId: entry.id })
  }

  function askRemove(id: string, title: string) {
    if (pendingAuth || remove.isPending) {
      return
    }
    setPendingRemove({ id, title })
  }

  function confirmRemove() {
    if (!pendingRemove) {
      return
    }
    const { id } = pendingRemove
    setPendingRemove(undefined)
    remove.mutate(id)
  }

  function cancelRemove() {
    setPendingRemove(undefined)
  }

  const dialogOpen = Boolean(pendingAuth || pendingRemove)

  usePaneFlags('specs', {
    hasSpecs: apis.length > 0,
    hasAuthRedirect: Boolean(pendingAuth),
    hasRemoveConfirm: Boolean(pendingRemove),
  })
  useStepKeys('specs', move, apis.length > 0 && !dialogOpen)
  usePaneActions('specs', {
    ...Object.fromEntries(
      CATALOG.map((entry) => [
        catalogActionId(entry),
        { callback: () => launch(entry), enabled: !dialogOpen },
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
      enabled: !dialogOpen && apis.length > 0,
    },
    remove: {
      callback: () => {
        const api = apis[selected]
        if (api) {
          askRemove(api.id, api.title)
        }
      },
      enabled: !dialogOpen && apis.length > 0,
    },
    confirmRemove,
    cancelRemove,
    continueAuth: finishPendingAuthRedirect,
    cancelAuth: cancelAuthorization,
    insert: {
      callback: () => {
        activate('specs', 'edit')
        urlRef.current?.focus()
      },
      enabled: !dialogOpen,
    },
    ...Object.fromEntries(
      sourceOptions.map((option) => [
        sourceSubmitActionId(option.kind),
        { callback: () => submit(option.kind), enabled: !dialogOpen, ignoreInputs: false },
      ]),
    ),
    command: () => {
      enterCommand()
      blurActive()
    },
  })

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
                sourceUrlKey(api.sourceUrl) === sourceUrlKey(catalogSourceUrl(entry)),
            )
            const hotkey = showKeybindings ? (
              <span className="ml-auto inline-flex w-4 shrink-0 justify-center">
                <Kbd hotkey={entry.hotkey} />
              </span>
            ) : null
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left outline-none disabled:opacity-50 ${
                    added
                      ? 'bg-[color-mix(in_srgb,var(--ink)_10%,var(--paper))] hover:bg-ink/10 focus-visible:bg-ink/10'
                      : 'hover:bg-ink/10 focus-visible:bg-ink/10'
                  }`}
                  disabled={openSource.isPending || dialogOpen}
                  onClick={() => launch(entry)}
                >
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
                  {added ? <span className="sr-only">added</span> : null}
                  {hotkey}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  if (pendingAuth) {
    return (
      <StatusPane>
        <AuthRedirect
          href={pendingAuth.href}
          name={
            CATALOG.find((entry) => entry.id === pendingAuth.entryId)?.title ??
            apis.find((api) => api.id === pendingAuth.sourceId)?.title
          }
          onCancel={cancelAuthorization}
        />
      </StatusPane>
    )
  }

  if (pendingRemove) {
    return (
      <StatusPane>
        <RemoveConfirm
          title={pendingRemove.title}
          onConfirm={confirmRemove}
          onCancel={cancelRemove}
        />
      </StatusPane>
    )
  }

  return (
    <main id="main" className="flex h-full min-h-0 flex-col overflow-y-auto px-3 md:px-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-10">
        <div className="mx-auto">
          <Brand hero />
        </div>
        <div className="mx-auto w-full max-w-xl">
          <form
            ref={formRef}
            data-oc-enter-submit="true"
            onSubmit={(event) => {
              event.preventDefault()
            }}
            onFocus={() => setUrlFocused(true)}
            onBlur={(event) => {
              const next = event.relatedTarget
              if (next instanceof Node && event.currentTarget.contains(next)) {
                return
              }
              setUrlFocused(false)
            }}
            className="w-full"
          >
          <label htmlFor="url" className="sr-only">
            MCP endpoint or OpenAPI document URL
          </label>
          <div className="relative min-w-0 w-full">
            <input
              ref={urlRef}
              id="url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={openSource.isPending || dialogOpen}
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
          {showSubmitButtons ? (
            <div className="mt-2 flex gap-2">
              {sourceOptions.map((option, index) => {
                const pending =
                  submittingUrl && openSource.variables?.kind === option.kind
                return (
                  <button
                    key={option.kind}
                    type="button"
                    className={`${index === 0 ? primaryButtonClass : softButtonClass} min-w-0 flex-1 whitespace-nowrap`}
                    disabled={openSource.isPending || dialogOpen}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => submit(option.kind)}
                  >
                    {pending ? 'Reading…' : option.label}
                    {showKeybindings ? null : <Kbd hotkey={option.submitHotkey} persistent />}
                  </button>
                )
              })}
            </div>
          ) : null}
          {!showSubmitButtons && !url.trim() ? (
            <p className="mt-2 text-center text-sm text-mute">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-signal underline underline-offset-2"
              >
                100% open source
              </a>
              . MIT License
            </p>
          ) : null}
          {urlError ? (
            <p className="mt-2 line-clamp-3 break-words text-sm text-error" role="alert">
              {urlError}
            </p>
          ) : null}
        </form>
        </div>

        <div className="space-y-6">
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
                {dialogOpen || !showKeybindings ? null : (
                  <KeyHints className="flex items-center gap-2 text-faint">
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Kbd hotkey="Enter" /> open
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Kbd hotkey="D" /> remove
                    </span>
                    {canStepDown ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Kbd hotkey="J" /> down
                        </span>
                      </>
                    ) : null}
                    {canStepUp ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Kbd hotkey="K" /> up
                        </span>
                      </>
                    ) : null}
                  </KeyHints>
                )}
              </div>
              <ul>
                {apis.map((api, index) => {
                  const active = index === selected
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
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-mute outline-none hover:text-signal focus-visible:text-signal disabled:opacity-40"
                        aria-label={`Remove ${api.title}`}
                        onClick={() => askRemove(api.id, api.title)}
                        disabled={remove.isPending || dialogOpen}
                      >
                        <TrashIcon />
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
    </main>
  )
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function RemoveConfirm({
  title,
  onConfirm,
  onCancel,
}: {
  title: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex w-full flex-col items-center px-4 text-center">
      <p className="max-w-xl text-sm text-ink">Remove {title}?</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" className={primaryButtonClass} onClick={onConfirm}>
          Remove
          <Kbd hotkey="Enter" persistent />
        </button>
        <button type="button" className={softButtonClass} onClick={onCancel}>
          Cancel
          <Kbd hotkey="Escape" persistent />
        </button>
      </div>
    </div>
  )
}
