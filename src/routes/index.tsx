import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Kbd } from '../components/hints'
import { QueryMessage } from '../components/query-status'
import { addApi, removeApi } from '../lib/apis'
import { blurActive } from '../lib/focus'
import { apisQueryOptions, queryErrorMessage } from '../lib/queries'
import { usePaneActions, usePaneFlags, useStepKeys } from '../lib/keys'
import { activate, enterCommand } from '../lib/mode'
import { sourceAdapterOptions } from '../lib/source-adapters'
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
  const sourceKindRef = useRef<HTMLSelectElement>(null)
  const [selected, setSelected] = useState(0)
  const sourceOptions = sourceAdapterOptions()
  const [sourceKind, setSourceKind] = useState(sourceOptions[0]?.kind ?? 'openapi')
  const sourceOption = sourceOptions.find((option) => option.kind === sourceKind)
  const apis = apisQuery.data ?? []

  const add = useMutation({
    mutationFn: ({
      url,
      kind,
      credentials,
    }: {
      url: string
      kind: string
      credentials: Record<string, string>
    }) => addApi(url, kind, credentials),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({
        queryKey: apisQueryOptions.queryKey,
      })
      await router.navigate({
        to: '/apis/$apiId/$pane/{-$operationId}',
        params: { apiId: id, pane: 'routes', operationId: undefined },
      })
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

  usePaneFlags('specs', { hasSpecs: apis.length > 0 })
  useStepKeys('specs', move, apis.length > 0)
  usePaneActions('specs', {
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
      enabled: apis.length > 0,
    },
    insert: () => {
      activate('specs', 'edit')
      urlRef.current?.focus()
    },
    sourceType: {
      callback: () => {
        sourceKindRef.current?.focus()
        sourceKindRef.current?.showPicker?.()
      },
      ignoreInputs: false,
    },
    command: () => {
      enterCommand()
      blurActive()
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const url = String(values.get('url') ?? '').trim()
    const credentials = Object.fromEntries(
      (sourceOption?.credentialFields ?? [])
        .map((field) => [field.name, String(values.get(field.name) ?? '').trim()])
        .filter(([, value]) => value),
    )
    add.mutate({ url, kind: sourceKind, credentials })
  }

  function onRemove(id: string, title: string) {
    if (!window.confirm(`Remove ${title}?`)) {
      return
    }
    remove.mutate(id)
  }

  return (
    <main
      id="main"
      className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden px-3 pt-8 md:px-4"
    >
      <form
        data-oc-enter-submit="true"
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
      >
        <label htmlFor="source-kind" className="sr-only">
          Source type
        </label>
        <div className="flex min-w-0 flex-1">
          <div className="relative shrink-0">
            <select
            ref={sourceKindRef}
            id="source-kind"
            name="source-kind"
            data-oc-command-focus="true"
            className="min-h-11 appearance-none bg-ink/5 py-2 pl-3 pr-9 text-sm text-ink outline-none hover:bg-ink/10 focus:bg-ink/10"
            value={sourceKind}
            onChange={(event) => {
              setSourceKind(event.target.value)
              event.currentTarget.blur()
              enterCommand()
            }}
          >
            {sourceOptions.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-mute"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </div>
          <label htmlFor="url" className="sr-only">
            {sourceOption?.inputLabel ?? 'Source URL'}
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
            className={`${inputClass} border-l-0 pl-10`}
            placeholder={sourceOption?.placeholder}
            onFocus={() => {
              activate('specs', 'edit')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            />
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Kbd hotkey="I" />
            </span>
          </div>
        </div>
        {(sourceOption?.credentialFields ?? []).map((field) => (
          <label key={field.name} className="min-w-0 flex-1">
            <span className="sr-only">{field.label}</span>
            <input
              name={field.name}
              type={field.type ?? 'text'}
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
              placeholder={field.placeholder ?? field.label}
              onFocus={() => {
                activate('specs', 'edit')
              }}
            />
          </label>
        ))}
        <button type="submit" className={`${primaryButtonClass} shrink-0`} disabled={add.isPending}>
          {add.isPending ? 'Reading…' : 'Add source'}
        </button>
      </form>
      {add.isError ? (
        <p className="mt-3 text-sm text-signal" role="alert">
          {queryErrorMessage(add.error, 'Could not read that source.')}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {apisQuery.isPending ? (
          <div className="mt-8">
            <QueryMessage label="Loading sources…" />
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
          <p className="mt-8 text-sm text-mute">Add a source URL to list its executables.</p>
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
                    to="/apis/$apiId/$pane/{-$operationId}"
                    params={{
                      apiId: api.id,
                      pane: 'routes',
                      operationId: undefined,
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-1 outline-none focus-visible:text-signal"
                    onFocus={() => setSelected(index)}
                  >
                    <span className="inline-flex w-8 shrink-0 justify-end">
                      {navigationHint ? <Kbd hotkey={navigationHint} /> : null}
                    </span>
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
        )}
        {remove.isError ? (
          <p className="mt-3 text-sm text-signal" role="alert">
            {queryErrorMessage(remove.error, 'Could not remove that source.')}
          </p>
        ) : null}
      </div>
    </main>
  )
}
