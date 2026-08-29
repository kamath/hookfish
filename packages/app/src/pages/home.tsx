import { useEffect, useRef, useState } from 'react'
import { UnauthorizedError } from '@modelcontextprotocol/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
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
import { visibleCarouselItems, wrappedCarouselIndex } from '../lib/carousel'
import { blurActive } from '../lib/focus'
import { apisQueryOptions, carouselQueryOptions, queryErrorMessage } from '../lib/queries'
import { usePaneActions, usePaneFlags, useShowKeybindings, useStepKeys } from '../lib/keys'
import { activate, enterCommand } from '../lib/mode'
import { fetchSession } from '../lib/session'
import { pendingMcpAuthorization, clearPendingMcpAuthorization } from '../lib/mcp/oauth'
import { primaryButtonClass, softInputClass } from '../lib/ui'

type PendingAuth = {
  href: string
  sourceId: string
  entryId?: string
}

type OpenSource = {
  url: string
  kind?: string
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

export function HomePage() {
  const apisQuery = useQuery(apisQueryOptions)
  const carouselQuery = useQuery(carouselQueryOptions)
  const session = useQuery({
    queryKey: ['auth-session'],
    queryFn: fetchSession,
  })
  const queryClient = useQueryClient()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const panelRefs = useRef<Record<string, HTMLElement | null>>({})
  const [url, setUrl] = useState('')
  const [urlFocused, setUrlFocused] = useState(false)
  const [activeRow, setActiveRow] = useState(0)
  const [activeItems, setActiveItems] = useState<Record<string, number>>({})
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | undefined>(() => {
    const pending = pendingMcpAuthorization()
    return pending
      ? { href: pending.url, sourceId: pending.sourceId }
      : undefined
  })
  const apis = apisQuery.data ?? []
  const carouselRows: CarouselRow[] = (carouselQuery.data ?? [])
    .filter((row) => row.source !== 'recent' || apis.length > 0)
    .map((row) => ({
      id: row.id,
      title: row.title,
      items:
        row.source === 'recent'
          ? visibleCarouselItems(apis).map((api) => ({
              type: 'recent' as const,
              id: api.id,
              title: api.title,
              detail: `${api.kind} · ${api.executableCount} executables${
                api.version ? ` · ${api.version}` : ''
              }`,
              apiId: api.id,
            }))
          : visibleCarouselItems(row.items).map((entry) => ({
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
        (api) =>
          sourceUrlKey(api.sourceUrl) === key &&
          (kind === undefined || api.kind === kind),
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
  const canMoveLists = carouselRows.length > 1

  useEffect(() => {
    activate('specs', 'command')
  }, [])

  useEffect(() => {
    setActiveRow((index) => Math.min(index, Math.max(carouselRows.length - 1, 0)))
  }, [carouselRows.length])

  function moveList(delta: number) {
    setActiveRow((index) => {
      const nextIndex = wrappedCarouselIndex(index, delta, carouselRows.length)
      const nextRow = carouselRows[nextIndex]
      if (nextRow) {
        requestAnimationFrame(() => {
          panelRefs.current[nextRow.id]?.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
          })
        })
      }
      return nextIndex
    })
  }

  function moveItem(delta: number) {
    const row = carouselRows[activeRow]
    if (!row || row.items.length === 0) {
      return
    }
    setActiveItems((current) => {
      const nextIndex = wrappedCarouselIndex(
        current[row.id] ?? 0,
        delta,
        row.items.length,
      )
      return { ...current, [row.id]: nextIndex }
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

  function submit() {
    if (openSource.isPending || !formRef.current?.reportValidity()) {
      return
    }
    if (pendingAuth) {
      cancelAuthorization()
    }
    openSource.mutate({ url: url.trim() })
  }

  function launch(entry: CatalogEntry) {
    if (openSource.isPending) {
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

  const dialogOpen = Boolean(pendingAuth)

  usePaneFlags('specs', {
    hasCarousel: carouselRows.length > 0,
    hasAuthRedirect: Boolean(pendingAuth),
    signedOut: !session.data?.user,
  })
  useStepKeys('specs', moveItem, carouselRows.length > 0 && !dialogOpen)
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
    open: {
      callback: () => {
        const row = carouselRows[activeRow]
        if (!row) {
          return
        }
        const item = row.items[activeItems[row.id] ?? 0]
        if (item) {
          openCarouselItem(item)
        }
      },
      enabled: !dialogOpen && Boolean(carouselRows[activeRow]?.items.length),
    },
    carouselPrevious: {
      callback: () => moveList(-1),
      enabled: !dialogOpen && canMoveLists,
    },
    carouselNext: {
      callback: () => moveList(1),
      enabled: !dialogOpen && canMoveLists,
    },
    continueAuth: finishPendingAuthRedirect,
    cancelAuth: cancelAuthorization,
    insert: {
      callback: () => {
        activate('specs', 'edit')
        urlRef.current?.focus()
      },
      enabled: !dialogOpen,
    },
    signIn: {
      callback: () => {
        void router.navigate({ to: '/login' })
      },
      enabled: !dialogOpen && !session.data?.user,
    },
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
        ref={(node) => {
          panelRefs.current[row.id] = node
        }}
        className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start bg-ink/5 px-3 py-3"
        aria-label={`${row.title} list`}
        onMouseDown={() => setActiveRow(rowIndex)}
        onFocus={() => setActiveRow(rowIndex)}
      >
        <div className="mb-2 flex min-h-7 items-center gap-2">
          <h2 className="font-mono text-[11px] text-mute">{row.title}</h2>
          {active && showKeybindings ? (
            <KeyHints className="ml-auto flex items-center gap-1 text-faint">
              <span className="inline-flex items-center gap-1">
                <Kbd hotkey="J" />
                <Kbd hotkey="K" />
              </span>
            </KeyHints>
          ) : null}
        </div>
        {row.items.length > 0 ? (
          <ul>
            {row.items.map((item, index) => {
              const itemActive = active && (activeItems[row.id] ?? 0) === index
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
                  className={
                    itemActive ? 'bg-signal/20' : added ? 'bg-ink/10' : 'bg-paper/70'
                  }
                >
                <button
                  type="button"
                    className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-ink/10 focus-visible:bg-ink/10 disabled:opacity-50"
                  disabled={openSource.isPending || dialogOpen}
                    onClick={() => openCarouselItem(item)}
                    onFocus={() => {
                      setActiveRow(rowIndex)
                      setActiveItems((current) => ({ ...current, [row.id]: index }))
                    }}
                >
                  <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
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
              </li>
            )
          })}
        </ul>
        ) : (
          <p className="flex min-h-55 items-center justify-center bg-paper/70 px-3 text-center text-sm text-mute">
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
              submit()
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
            <div className="mt-2">
              <button
                type="submit"
                className={`${primaryButtonClass} w-full`}
                disabled={openSource.isPending || dialogOpen}
              >
                {submittingUrl ? 'Opening…' : 'Open'}
                {showKeybindings ? null : <Kbd hotkey="Enter" persistent />}
              </button>
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
            <div>
              <div className="mb-2 flex min-h-7 items-center gap-2 px-1">
                {showKeybindings ? (
                  <KeyHints className="flex items-center gap-2 text-faint">
                    <span className="inline-flex items-center gap-1">
                      <Kbd hotkey="H" />
                      <Kbd hotkey="L" /> lists
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Kbd hotkey="J" />
                      <Kbd hotkey="K" /> items
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Kbd hotkey="1" />–<Kbd hotkey="5" /> open
                    </span>
                  </KeyHints>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center bg-ink/5 text-mute outline-none hover:bg-ink/10 hover:text-signal focus-visible:bg-ink/10 focus-visible:text-signal disabled:opacity-30"
                    aria-label="Previous list"
                    disabled={!canMoveLists}
                    onClick={() => moveList(-1)}
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center bg-ink/5 text-mute outline-none hover:bg-ink/10 hover:text-signal focus-visible:bg-ink/10 focus-visible:text-signal disabled:opacity-30"
                    aria-label="Next list"
                    disabled={!canMoveLists}
                    onClick={() => moveList(1)}
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
              </div>
              <div
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Source lists"
              >
                {carouselRows.map(renderCarouselRow)}
              </div>
            </div>
          )}
          {apisQuery.isError ? (
            <QueryMessage
              error={apisQuery.error}
              onRetry={() => {
                void apisQuery.refetch()
              }}
            />
          ) : null}
        </div>
      </div>
    </main>
  )
}
