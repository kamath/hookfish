import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import validator from '@rjsf/validator-ajv8'
import type { IChangeEvent } from '@rjsf/core'
import type {
  ClientApi,
  ClientOperation,
  FormUiSchema,
  InvokeResult,
  JsonSchema,
} from '../lib/client-types'
import { fieldsFromForm, readApiAuth } from '../lib/auth'
import { asRecord, buildRequestUrl, omitEmpty } from '../lib/build-request'
import { toFetch, withAuthPlaceholders } from '../lib/export-snippet'
import { bindFormTabSync, selectDefaultFormItem, selectMatchingFormItem } from '../lib/form-nav'
import { submitForm } from '../lib/focus'
import { usePaneActions, usePaneFlags } from '../lib/keys'
import { activate, usePane } from '../lib/mode'
import { buildOperationRequest } from '../lib/invoke'
import { executeRequest } from '../lib/invoke.functions'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'
import { ResponsePane } from './response-pane'
import { SwissForm } from './swiss-form'

const AUTH_NOTICE = 'This request requires authorization.'

function withoutAuth(value: unknown) {
  const data = asRecord(value)
  if (!('auth' in data)) {
    return value
  }
  const { auth: _auth, ...rest } = data
  return rest
}

function withAuthSchema(schema: JsonSchema, authSchema: JsonSchema): JsonSchema {
  return {
    ...schema,
    properties: {
      ...asRecord(schema.properties),
      auth: {
        type: 'object',
        title: typeof authSchema.title === 'string' ? authSchema.title : 'Auth',
        properties: asRecord(authSchema.properties),
      },
    },
  }
}

function withAuthUiSchema(uiSchema: FormUiSchema, authUiSchema?: FormUiSchema): FormUiSchema {
  const extra = asRecord(authUiSchema)
  return {
    ...uiSchema,
    auth: {
      ...extra,
      'ui:options': {
        ...asRecord(extra['ui:options']),
        inline: true,
        notice: AUTH_NOTICE,
        wash: true,
        nest: true,
      },
    },
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

function mergeAuth(
  stored: Record<string, string>,
  typed: Record<string, string>,
): Record<string, string> {
  const next = { ...stored }
  for (const [name, value] of Object.entries(typed)) {
    if (value.trim()) {
      next[name] = value.trim()
    }
  }
  return next
}

export function OperationClient({
  api,
  operation,
  serverUrl,
  needsAuth,
  authSchema,
  authUiSchema,
  authPending,
  authError,
  onPreviousOperation,
  onNextOperation,
  onSaveAuth,
}: {
  api: ClientApi
  operation: ClientOperation
  serverUrl: string
  needsAuth: boolean
  authSchema?: JsonSchema
  authUiSchema?: FormUiSchema
  authPending?: boolean
  authError?: unknown
  onPreviousOperation?: () => void
  onNextOperation?: () => void
  onSaveAuth: (value: Record<string, unknown>) => Promise<void>
}) {
  const [formData, setFormData] = useState<unknown>({})
  const [lastSubmission, setLastSubmission] = useState<unknown>({})
  const [result, setResult] = useState<InvokeResult | null>(null)
  const [askingAuth, setAskingAuth] = useState(false)
  const [copied, setCopied] = useState(false)
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const pane = usePane()
  const navigate = useNavigate()
  const invoke = useMutation({
    mutationFn: (next: unknown) =>
      executeRequest({
        data: buildOperationRequest({
          serverUrl,
          operation,
          formData: next,
          auth: readApiAuth(api.id),
          authSchemes: api.authSchemes,
        }),
      }),
    onSuccess: (nextResult) => {
      setResult(nextResult)
      showResponse()
    },
  })
  const pending = invoke.isPending
  const error = invoke.isError ? queryErrorMessage(invoke.error, 'The request failed.') : null
  const showAuth = Boolean(askingAuth && needsAuth && authSchema)

  useEffect(() => {
    setAskingAuth(false)
    setCopied(false)
    const timer = window.setTimeout(() => selectDefaultFormItem('call-form'), 0)
    return () => window.clearTimeout(timer)
  }, [operation.id])

  useEffect(() => bindFormTabSync('call-form'), [operation.id])

  useEffect(() => {
    if (!showAuth) {
      return
    }
    const timer = window.setTimeout(
      () =>
        selectMatchingFormItem('call-form', (item) => {
          const prefix = `${operation.id}_auth`
          return item.id === prefix || item.id.startsWith(`${prefix}_`)
        }),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [operation.id, showAuth])

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyFetch() {
    try {
      const data = asRecord(formDataRef.current)
      const ok = await copyText(
        toFetch(
          buildOperationRequest({
            serverUrl,
            operation,
            formData: withoutAuth(data),
            auth: withAuthPlaceholders(
              mergeAuth(readApiAuth(api.id), fieldsFromForm(data.auth)),
              Object.keys(asRecord(authSchema?.properties)),
            ),
            authSchemes: api.authSchemes,
          }),
        ),
      )
      if (ok) {
        setCopied(true)
      }
    } catch {
      setCopied(false)
    }
  }

  usePaneFlags('input', { hasResult: Boolean(result) })
  usePaneActions('input', {
    send: {
      callback: () => {
        if (pending || authPending) {
          return
        }
        submitForm('call-form')
      },
      ignoreInputs: false,
    },
    output: () => showResponse(),
    copyFetch: () => {
      void copyFetch()
    },
  })
  usePaneActions('response', {
    parent: () => showInput(false),
  })

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
    setFormData(next)
    const request = withoutAuth(next)
    setLastSubmission(request)
    if (needsAuth && !askingAuth) {
      setAskingAuth(true)
      return
    }
    if (needsAuth) {
      void onAuthContinue(asRecord(asRecord(next).auth), request)
      return
    }
    invoke.mutate(request)
  }

  async function onAuthContinue(value: Record<string, unknown>, request: unknown) {
    await onSaveAuth(value)
    setAskingAuth(false)
    invoke.mutate(request)
  }

  function showInput(insert: boolean) {
    activate('input', 'command')
    void navigate({
      to: '/apis/$apiId/$pane/{-$operationId}',
      params: { apiId: api.id, pane: 'input', operationId: operation.id },
      replace: true,
      resetScroll: false,
    })
    if (insert) {
      window.setTimeout(() => selectDefaultFormItem('call-form'), 0)
    }
  }

  function showResponse() {
    activate('response', 'command')
    void navigate({
      to: '/apis/$apiId/$pane/{-$operationId}',
      params: { apiId: api.id, pane: 'response', operationId: operation.id },
      replace: true,
      resetScroll: false,
    })
  }

  if (pane === 'response' && result) {
    return (
      <div className={`api-context api-${operation.method} h-full min-h-0`}>
        <ResponsePane
          result={result}
          pending={pending}
          error={error}
          onBack={() => showInput(false)}
          onResend={() => invoke.mutate(lastSubmission)}
        />
      </div>
    )
  }

  if (pane === 'response') {
    return (
      <section className="flex h-full min-h-0 items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm text-mute">No response is available in this session.</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 text-sm text-ink hover:text-signal"
            onClick={() => showInput(false)}
          >
            Input
            <Kbd hotkey="Escape" />
          </button>
        </div>
      </section>
    )
  }

  return (
    <div
      data-oc-operation
      data-oc-method={operation.method}
      className={`api-context api-${operation.method} h-full min-h-0 overflow-hidden`}
    >
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-baseline gap-3 border-b border-rule bg-paper px-3 py-2 md:px-4">
          <span data-oc-method-label className="api-ink font-mono text-xs tabular-nums">
            {operation.method.toUpperCase()}
          </span>
          <span className="min-w-0 truncate font-mono text-xs text-ink">{operation.path}</span>
          {operation.deprecated ? <span className="text-xs text-signal">deprecated</span> : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-2 bg-ink/10 px-2 py-1 text-xs text-mute hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!onPreviousOperation}
              onClick={onPreviousOperation}
            >
              Previous
              {onPreviousOperation ? <Kbd hotkey="H" /> : null}
            </button>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-2 bg-ink/10 px-2 py-1 text-xs text-mute hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!onNextOperation}
              onClick={onNextOperation}
            >
              Next
              {onNextOperation ? <Kbd hotkey="L" /> : null}
            </button>
            {result ? (
              <button
                type="button"
                className="inline-flex min-h-8 items-center gap-2 bg-ink/10 px-2 py-1 text-xs font-medium text-ink hover:bg-ink/15"
                onClick={showResponse}
              >
                View output
                <Kbd hotkey="O" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-3 py-3 md:px-4">
          <SwissForm
            id="call-form"
            schema={
              (showAuth && authSchema
                ? withAuthSchema(operation.schema, authSchema)
                : operation.schema) as never
            }
            uiSchema={
              (showAuth && authSchema
                ? withAuthUiSchema(operation.uiSchema, authUiSchema)
                : operation.uiSchema) as never
            }
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
              {authError ? (
                <p className="text-xs text-error" role="alert">
                  {queryErrorMessage(authError, 'Could not save those keys.')}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center justify-center gap-2 bg-ink/10 px-3 py-1 text-xs font-medium text-ink hover:bg-ink/15 outline-none"
                  aria-live="polite"
                  aria-label={copied ? 'Copied fetch' : 'Copy as fetch'}
                  onClick={() => {
                    void copyFetch()
                  }}
                >
                  {copied ? 'Copied' : 'Copy as fetch'}
                  <KeyHints>
                    <Kbd hotkey="Y" />
                  </KeyHints>
                </button>
                <button
                  type="submit"
                  className={`${formPrimaryButtonClass} api-solid`}
                  disabled={pending || authPending}
                >
                  {pending ? (
                    'Sending…'
                  ) : authPending ? (
                    'Saving…'
                  ) : (
                    <>
                      <KeyHints className="mr-2 inline-flex gap-1">
                        <Kbd hotkey="Mod" />
                        <Kbd hotkey="Enter" />
                      </KeyHints>
                      {showAuth ? 'Continue' : 'Send'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </SwissForm>
        </div>
      </section>
    </div>
  )
}
