import { useEffect, useRef, useState } from 'react'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AuthRedirect, finishPendingAuthRedirect } from '../components/auth-status'
import { Brand } from '../components/brand'
import { GITHUB_REPO_URL } from '../components/github-link'
import { KeyHints, Kbd } from '../components/hints'
import { QueryMessage, StatusPane } from '../components/query-status'
import { addApi, removeApi } from '../lib/apis'
import {
  carouselActionId,
  catalogSourceUrl,
  sourceUrlKey,
  type CatalogEntry,
} from '../lib/catalog'
import { blurActive } from '../lib/focus'
import { apisQueryOptions, carouselQueryOptions, queryErrorMessage } from '../lib/queries'
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

type CarouselItem =
  | {
      type: 'recent'
      id: string
      title: string
      detail: string
      apiId: string
    }
  | {
      type: 'catalog'
      id: string
      title: string
      detail: string
      entry: CatalogEntry
    }

type CarouselRow = {
  id: string
  title: string
  items: CarouselItem[]
}

function Home() {
  const apisQuery = useQuery(apisQueryOptions)
  const carouselQuery = useQuery(carouselQueryOptions)
  const queryClient = useQueryClient()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const carouselRefs = useRef<Record<string, HTMLUListElement | null>>({})
  const [url, setUrl] = useState('')
  const [urlFocused, setUrlFocused] = useState(false)
  const [activeRow, setActiveRow] = useState(0)
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | undefined>(() => {
    const pending = pendingMcpAuthorization()
    return pending
      ? { href: pending.url, sourceId: pending.sourceId }
      : undefined
  })
  const [pendingRemove, setPendingRemove] = useState<{ id: string; title: string }>()
  const sourceOptions = sourceAdapterOptions()
  const apis = apisQuery.data ?? []
  const carouselRows: CarouselRow[] = (carouselQuery.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    items:
      row.id === 'recent'
        ? apis.slice(0, 5).map((api) => ({
            type: 'recent' as const,
            id: api.id,
            title: api.title,
            detail: `${api.kind} · ${api.executableCount} executables${
              api.version ? ` · ${api.version}` : ''
            }`,
            apiId: api.id,
          }))
        : row.items.map((entry) => ({
            type: 'catalog' as const,
            id: entry.id,
            title: entry.title,
            detail: entry.detail,
            entry,
          })),
  }))
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
  const canStepDown = activeRow < carouselRows.length - 1
  const canStepUp = activeRow > 0

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
    setActiveRow((index) => {
      const last = Math.max(carouselRows.length - 1, 0)
      return Math.min(Math.max(index + delta, 0), last)
    })
  }

  function scrollCarousel(rowId: string, delta: number) {
    const carousel = carouselRefs.current[rowId]
    if (!carousel) {
      return
    }
    carousel.scrollBy({
      left: delta * (carousel.clientWidth / 2),
      behavior: 'smooth',
    })
  }

  function scrollActiveCarousel(delta: number) {
    const row = carouselRows[activeRow]
    if (row) {
      scrollCarousel(row.id, delta)
    }
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

  function openCarouselItem(item: CarouselItem) {
    if (item.type === 'catalog') {
      launch(item.entry)
      return
    }
    void router.navigate({
      to: '/apis/$apiId/$pane/{-$operationId}',
      params: { apiId: item.apiId, pane: 'routes', operationId: undefined },
    })
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
    hasCarousel: carouselRows.length > 0,
    hasAuthRedirect: Boolean(pendingAuth),
    hasRemoveConfirm: Boolean(pendingRemove),
  })
  useStepKeys('specs', move, carouselRows.length > 0 && !dialogOpen)
  usePaneActions('specs', {
    ...Object.fromEntries(
      [0, 1, 2, 3, 4].map((index) => [
        carouselActionId(index),
        {
          callback: () => {
            const item = carouselRows[activeRow]?.items[index]
            if (item) {
              openCarouselItem(item)
            }
          },
          enabled: !dialogOpen && Boolean(carouselRows[activeRow]?.items[index]),
        },
      ]),
    ),
    carouselPrevious: {
      callback: () => scrollActiveCarousel(-1),
      enabled: !dialogOpen,
    },
    carouselNext: {
      callback: () => scrollActiveCarousel(1),
      enabled: !dialogOpen,
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

  function renderCarouselRow(row: CarouselRow, rowIndex: number) {
    const active = rowIndex === activeRow
    return (
      <section
        key={row.id}
        className={`px-3 py-3 transition-colors ${
          active ? 'bg-signal/10' : 'bg-ink/5'
        }`}
        aria-label={`${row.title} carousel`}
        onMouseDown={() => setActiveRow(rowIndex)}
        onFocus={() => setActiveRow(rowIndex)}
      >
        <div className="mb-2 flex min-h-7 items-center gap-2">
          <h2 className="font-mono text-[11px] text-mute">{row.title}</h2>
          {active && showKeybindings ? (
            <KeyHints className="flex items-center gap-2 text-faint">
              {canStepUp ? (
                <span className="inline-flex items-center gap-1">
                  <Kbd hotkey="K" /> up
                </span>
              ) : null}
              {canStepDown ? (
                <span className="inline-flex items-center gap-1">
                  <Kbd hotkey="J" /> down
                </span>
              ) : null}
            </KeyHints>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center bg-ink/5 text-mute outline-none hover:bg-ink/10 hover:text-signal focus-visible:bg-ink/10 focus-visible:text-signal"
              aria-label={`Scroll ${row.title} left`}
              onClick={() => scrollCarousel(row.id, -1)}
            >
              <span aria-hidden="true">‹</span>
              {active ? <Kbd hotkey="H" /> : null}
            </button>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center bg-ink/5 text-mute outline-none hover:bg-ink/10 hover:text-signal focus-visible:bg-ink/10 focus-visible:text-signal"
              aria-label={`Scroll ${row.title} right`}
              onClick={() => scrollCarousel(row.id, 1)}
            >
              {active ? <Kbd hotkey="L" /> : null}
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
        {row.items.length > 0 ? (
          <ul
            ref={(node) => {
              carouselRefs.current[row.id] = node
            }}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {row.items.map((item, index) => {
              const status = item.type === 'catalog' ? entryStatus(item.entry) : undefined
              const added =
                item.type === 'catalog' &&
                apis.some(
                  (api) =>
                    api.kind === item.entry.kind &&
                    sourceUrlKey(api.sourceUrl) ===
                      sourceUrlKey(catalogSourceUrl(item.entry)),
                )
            return (
                <li
                  key={item.id}
                  className={`relative w-[calc((100%-0.75rem)/2)] shrink-0 snap-start ${
                    added ? 'bg-ink/10' : 'bg-paper/70'
                  }`}
                >
                <button
                  type="button"
                    className="flex min-h-24 w-full items-start gap-3 px-3 py-3 text-left outline-none hover:bg-ink/10 focus-visible:bg-ink/10 disabled:opacity-50"
                  disabled={openSource.isPending || dialogOpen}
                    onClick={() => openCarouselItem(item)}
                >
                  <span className="min-w-0 flex-1">
                      <span className="block truncate pr-7 text-sm text-ink">
                        {item.title}
                      </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-faint">
                        {item.detail}
                    </span>
                      {status?.message ? (
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
                    {active && showKeybindings ? (
                      <span className="ml-auto inline-flex w-4 shrink-0 justify-center">
                        <Kbd hotkey={String(index + 1)} />
                      </span>
                    ) : null}
                </button>
                  {item.type === 'recent' ? (
                    <button
                      type="button"
                      className="absolute right-1 top-1 inline-flex size-8 items-center justify-center text-mute outline-none hover:text-signal focus-visible:text-signal disabled:opacity-40"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => askRemove(item.apiId, item.title)}
                      disabled={remove.isPending || dialogOpen}
                    >
                      <TrashIcon />
                    </button>
                  ) : null}
              </li>
            )
          })}
        </ul>
        ) : (
          <p className="flex min-h-24 items-center justify-center bg-paper/70 px-3 text-center text-sm text-mute">
            Open a source and it will appear here.
          </p>
        )}
      </section>
    )
  }

  if (pendingAuth) {
    return (
      <StatusPane>
        <AuthRedirect
          href={pendingAuth.href}
          name={
            carouselQuery.data
              ?.flatMap((row) => row.items)
              .find((entry) => entry.id === pendingAuth.entryId)?.title ??
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
              {' '}
              (MIT License)
            </p>
          ) : null}
          {urlError ? (
            <p className="mt-2 line-clamp-3 break-words text-sm text-error" role="alert">
              {urlError}
            </p>
          ) : null}
        </form>
        </div>

        <div className="space-y-3">
          {carouselQuery.isPending ? (
            <QueryMessage label="Loading carousel…" />
          ) : carouselQuery.isError ? (
            <QueryMessage
              error={carouselQuery.error}
              onRetry={() => {
                void carouselQuery.refetch()
              }}
            />
          ) : (
            carouselRows.map(renderCarouselRow)
          )}
          {apisQuery.isError ? (
            <QueryMessage
              error={apisQuery.error}
              onRetry={() => {
                void apisQuery.refetch()
              }}
            />
          ) : null}
          {remove.isError ? (
            <p className="text-sm text-error" role="alert">
              {queryErrorMessage(remove.error, 'Could not remove that source.')}
            </p>
          ) : null}
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
