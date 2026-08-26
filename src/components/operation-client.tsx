import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import validator from '@rjsf/validator-ajv8'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { IChangeEvent } from '@rjsf/core'
import type { ClientApi, ClientOperation } from '../lib/client-types'
import { asRecord, buildRequestUrl, omitEmpty } from '../lib/build-request'
import { bindFormTabSync, selectDefaultInput } from '../lib/form-nav'
import { submitForm } from '../lib/focus'
import { useChrome } from '../lib/mode'
import { invokeOperation } from '../lib/invoke.functions'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { Kbd } from './hints'
import { SwissForm } from './swiss-form'

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function OperationClient({
  api,
  operation,
  serverUrl,
}: {
  api: ClientApi
  operation: ClientOperation
  serverUrl: string
}) {
  const [formData, setFormData] = useState<unknown>({})
  const invoke = useMutation({
    mutationFn: (next: unknown) =>
      invokeOperation({
        data: {
          apiId: api.id,
          operationId: operation.id,
          serverUrl,
          formData: asRecord(next),
        },
      }),
  })
  const pending = invoke.isPending
  const error = invoke.isError
    ? queryErrorMessage(invoke.error, 'The request failed.')
    : null
  const result = invoke.data ?? null

  useEffect(() => {
    const timer = window.setTimeout(() => selectDefaultInput('call-form'), 0)
    return () => window.clearTimeout(timer)
  }, [operation.id])

  useEffect(() => bindFormTabSync('call-form'), [operation.id])

  const { pane } = useChrome()
  useHotkey(
    'Mod+Enter',
    () => {
      if (!pending) {
        submitForm('call-form')
      }
    },
    { enabled: pane === 'form', ignoreInputs: false },
  )

  const previewUrl = useMemo(() => {
    const data = asRecord(formData)
    try {
      return buildRequestUrl(
        serverUrl,
        operation.path,
        asRecord(omitEmpty(data.path)),
        asRecord(omitEmpty(data.query)),
      )
    } catch {
      return `${serverUrl}${operation.path}`
    }
  }, [formData, operation.path, serverUrl])

  function onSubmit({ formData: next }: IChangeEvent) {
    invoke.mutate(next)
  }

  return (
    <div
      data-oc-operation
      data-oc-method={operation.method}
      className={`grid h-full min-h-0 grid-cols-1 overflow-hidden ${
        result ? 'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]' : ''
      }`}
    >
      <section className="flex min-h-0 min-w-0 flex-col overflow-y-auto lg:border-r lg:border-rule">
        <div className="sticky top-0 z-10 flex items-baseline gap-3 border-b border-rule bg-paper px-3 py-2 md:px-4">
          <span data-oc-method-label className="font-mono text-xs tabular-nums">
            {operation.method.toUpperCase()}
          </span>
          <span className="min-w-0 truncate font-mono text-xs text-ink">
            {operation.path}
          </span>
          {operation.deprecated ? (
            <span className="text-xs text-signal">deprecated</span>
          ) : null}
        </div>

        <div className="px-3 py-3 md:px-4">
          <SwissForm
            id="call-form"
            schema={operation.schema as never}
            uiSchema={operation.uiSchema as never}
            validator={validator}
            formData={formData}
            onChange={(event: IChangeEvent) => setFormData(event.formData)}
            onSubmit={onSubmit}
            showErrorList={false}
            omitExtraData
            idPrefix={operation.id}
          >
            <div className="flex flex-col gap-2 pt-3">
              <p className="break-all font-mono text-xs text-mute">{previewUrl}</p>
              {error ? (
                <p className="text-xs text-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className={formPrimaryButtonClass} disabled={pending}>
                {pending ? (
                  'Sending…'
                ) : (
                  <>
                    <span className="mr-2 inline-flex gap-1">
                      <Kbd hotkey="Mod" />
                      <Kbd hotkey="Enter" />
                    </span>
                    Send
                  </>
                )}
              </button>
            </div>
          </SwissForm>
        </div>
      </section>

      {result ? (
        <section className="flex min-h-0 flex-col overflow-y-auto" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 border-b border-rule px-3 py-2 md:px-4">
            <p className="font-mono text-xs tabular-nums text-ink">
              {result.status} {result.statusText}
            </p>
            <p className="font-mono text-xs text-faint">
              {new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
                result.elapsedMs,
              )}
              &nbsp;ms
            </p>
          </div>
          <div className="min-w-0 px-3 py-4 md:px-4">
            {result.headers.length > 0 ? (
              <details className="mb-3">
                <summary className="cursor-pointer text-xs text-mute">Headers</summary>
                <dl className="mt-2 space-y-1">
                  {result.headers.map((header) => (
                    <div key={`${header.name}:${header.value}`}>
                      <dt className="font-mono text-[11px] text-faint">{header.name}</dt>
                      <dd className="break-words font-mono text-xs">{header.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}
            <pre className="overflow-x-auto text-sm leading-relaxed">
              <code className="font-mono">
                {result.body ? formatBody(result.body) : 'Empty body'}
              </code>
            </pre>
          </div>
        </section>
      ) : null}
    </div>
  )
}
