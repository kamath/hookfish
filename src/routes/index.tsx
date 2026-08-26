import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useHotkeys } from '@tanstack/react-hotkeys'
import { QueryMessage } from '../components/query-status'
import { addApi, removeApi } from '../lib/apis.functions'
import { blurActive } from '../lib/focus'
import { apisQueryOptions, queryErrorMessage } from '../lib/queries'
import { useStepKeys } from '../lib/keys'
import { inputClass, primaryButtonClass } from '../lib/ui'
import { HintBar } from '../components/hints'

export const Route = createFileRoute('/')({
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
    mutationFn: (url: string) => addApi({ data: { url } }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: apisQueryOptions.queryKey })
      await router.navigate({ to: '/apis/$apiId', params: { apiId: id } })
    },
    onError: () => {
      urlRef.current?.focus()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeApi({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apisQueryOptions.queryKey })
    },
  })

  useEffect(() => {
    urlRef.current?.focus()
  }, [])

  function move(delta: number) {
    setSelected((index) => {
      const last = Math.max(apis.length - 1, 0)
      return Math.min(Math.max(index + delta, 0), last)
    })
  }

  useStepKeys(move, apis.length > 0)

  useHotkeys([
    {
      hotkey: 'Escape',
      callback: () => {
        blurActive()
        setHelp(false)
      },
    },
    {
      hotkey: 'I',
      callback: () => {
        urlRef.current?.focus()
      },
    },
    {
      hotkey: 'Enter',
      callback: () => {
        const api = apis[selected]
        if (api) {
          void router.navigate({ to: '/apis/$apiId', params: { apiId: api.id } })
        }
      },
      options: { enabled: apis.length > 0 },
    },
    {
      hotkey: 'Backspace',
      callback: () => {
        blurActive()
      },
    },
    {
      hotkey: { key: '/', shift: true },
      callback: () => setHelp((value) => !value),
    },
  ])

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

  const hints = [
    { hotkey: 'Enter', label: 'open' },
    ...(apis.length > 0
      ? [
          { hotkey: 'J', label: 'next spec' },
          { hotkey: 'K', label: 'previous spec' },
        ]
      : []),
    { hotkey: 'Escape', label: 'leave the field' },
    { hotkey: 'Backspace', label: 'leave the field' },
    { hotkey: 'I', label: 'insert' },
    { hotkey: { key: '/', shift: true }, label: 'keys' },
  ]

  return (
    <main id="main" className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden px-3 pt-8 md:px-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label htmlFor="url" className="sr-only">
          OpenAPI URL
        </label>
        <input
          ref={urlRef}
          id="url"
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          required
          className={inputClass}
          placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
        />
        <button type="submit" className={`${primaryButtonClass} shrink-0`} disabled={add.isPending}>
          {add.isPending ? 'Reading…' : 'Open'}
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
          <ul className="mt-8 divide-y divide-rule border-y border-rule">
            {apis.map((api, index) => {
              const active = index === selected
              return (
                <li
                  key={api.id}
                  className={`flex items-center gap-3 py-3 ${active ? 'bg-signal/10' : ''}`}
                >
                  <Link
                    to="/apis/$apiId"
                    params={{ apiId: api.id }}
                    className="min-w-0 flex-1 px-1 outline-none focus-visible:text-signal"
                    onFocus={() => setSelected(index)}
                  >
                    <span className="block truncate text-sm text-ink">{api.title}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-faint">
                      {api.operationCount} ops
                      {api.version ? ` · ${api.version}` : ''}
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
      <HintBar items={hints} />
    </main>
  )
}
