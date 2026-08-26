import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Kbd } from '../components/hints'
import { QueryMessage } from '../components/query-status'
import { addApi, removeApi } from '../lib/apis'
import { ARCADE_SPEC_URL } from '../lib/defaults'
import { blurActive } from '../lib/focus'
import { apisQueryOptions, queryErrorMessage } from '../lib/queries'
import { useStepKeys, useViewActions, useViewFlags } from '../lib/keys'
import { activate, enterCommand } from '../lib/mode'
import { inputClass, primaryButtonClass } from '../lib/ui'

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home,
})

function Home() {
  const apisQuery = useQuery(apisQueryOptions)
  const queryClient = useQueryClient()
  const router = useRouter()
  const urlRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState(0)
  const [help, setHelp] = useState(false)
  const apis = apisQuery.data ?? []

  const add = useMutation({
    mutationFn: (url: string) => addApi(url),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: apisQueryOptions.queryKey })
      await router.navigate({ to: '/apis/$apiId', params: { apiId: id } })
    },
    onError: () => {
      urlRef.current?.focus()
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      removeApi(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apisQueryOptions.queryKey })
    },
  })

  useEffect(() => {
    activate('home', 'command')
  }, [])

  function move(delta: number) {
    setSelected((index) => {
      const last = Math.max(apis.length - 1, 0)
      return Math.min(Math.max(index + delta, 0), last)
    })
  }

  useViewFlags('home', { hasSpecs: apis.length > 0 })
  useStepKeys('home', move, apis.length > 0)
  useViewActions('home', {
    open: {
      callback: () => {
        const api = apis[selected]
        if (api) {
          void router.navigate({ to: '/apis/$apiId', params: { apiId: api.id } })
        }
      },
      enabled: apis.length > 0,
    },
    insert: () => {
      activate('home', 'edit')
      urlRef.current?.focus()
    },
    keys: () => setHelp((value) => !value),
    command: () => {
      enterCommand()
      blurActive()
      setHelp(false)
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const url = String(new FormData(form).get('url') ?? '').trim()
    add.mutate(url)
  }

  function onRemove(id: string, title: string) {
    if (!window.confirm(`Remove ${title}?`)) {
      return
    }
    remove.mutate(id)
  }

  return (
    <main id="main" className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden px-3 pt-8 md:px-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label htmlFor="url" className="sr-only">
          OpenAPI URL
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
            className={`${inputClass} pr-10`}
            placeholder={ARCADE_SPEC_URL}
            onFocus={() => {
              activate('home', 'edit')
            }}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <Kbd hotkey="I" />
          </span>
        </div>
        <button
          type="submit"
          className={`${primaryButtonClass} shrink-0`}
          disabled={add.isPending}
        >
          {add.isPending ? 'Reading…' : 'Open'}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-rule px-3 py-2 text-sm text-ink hover:bg-ink/10"
          aria-expanded={help}
          onClick={() => setHelp((value) => !value)}
        >
          Keys
          <Kbd hotkey={{ key: '/', shift: true }} />
        </button>
      </form>
      {add.isError ? (
        <p className="mt-3 text-sm text-signal" role="alert">
          {queryErrorMessage(add.error, 'Could not read that spec.')}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {apisQuery.isPending ? (
          <div className="mt-8">
            <QueryMessage label="Loading specs…" />
          </div>
        ) : apisQuery.isError ? (
          <div className="mt-8">
            <QueryMessage
              error={apisQuery.error}
              onRetry={() => {
                void apisQuery.refetch()
              }}
            />
          </div>
        ) : apis.length === 0 ? (
          <p className="mt-8 text-sm text-mute">Paste a spec URL to open a client.</p>
        ) : (
          <ul className="mt-8">
            {apis.map((api, index) => {
              const active = index === selected
              const navigationHint = active
                ? 'Enter'
                : index === selected - 1
                  ? 'K'
                  : index === selected + 1
                    ? 'J'
                    : undefined
              return (
                <li
                  key={api.id}
                  className={`flex items-center gap-3 px-3 py-3 md:px-4 ${active ? 'bg-signal/10' : ''}`}
                >
                  <Link
                    to="/apis/$apiId"
                    params={{ apiId: api.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-1 outline-none focus-visible:text-signal"
                    onFocus={() => setSelected(index)}
                  >
                    <span className="inline-flex w-8 shrink-0 justify-end">
                      {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{api.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-faint">
                        {api.operationCount} ops
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
        )}
        {remove.isError ? (
          <p className="mt-3 text-sm text-signal" role="alert">
            {queryErrorMessage(remove.error, 'Could not remove that spec.')}
          </p>
        ) : null}
      </div>

      {help ? (
        <p className="pb-2 text-xs text-mute">
          URL is first. Enter opens it. After Escape, j and k move through saved specs.
        </p>
      ) : null}
    </main>
  )
}
