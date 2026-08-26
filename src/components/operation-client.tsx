import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import validator from '@rjsf/validator-ajv8'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { IChangeEvent } from '@rjsf/core'
import type { ClientApi, ClientOperation, FormUiSchema, InvokeResult, JsonSchema } from '../lib/client-types'
import { bindFormTabSync, insertCurrentInput, selectDefaultInput } from '../lib/form-nav'
import { submitForm } from '../lib/focus'
import { activate, useChrome } from '../lib/mode'
import { readApiAuth } from '../lib/auth'
import { toFetch } from '../lib/export-snippet'
import { buildOperationRequest } from '../lib/invoke'
import { executeRequest } from '../lib/invoke.functions'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { AuthFields } from './auth-fields'
import { Kbd } from './hints'
import { ResponsePane } from './response-pane'
import { SwissForm } from './swiss-form'

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

function CopyFetchButton({
  copied,
  onCopy,
  size,
}: {
  copied: boolean
  onCopy: () => void
  size: 'form' | 'toolbar'
}) {
  const className =
    size === 'toolbar'
      ? 'inline-flex items-center gap-2 border-0 bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink shadow-none outline-none hover:bg-ink/15'
      : 'inline-flex min-h-8 items-center justify-center gap-2 border-0 bg-ink/10 px-3 py-1 text-xs font-medium text-ink shadow-none outline-none hover:bg-ink/15'
  return (
    <button
      type="button"
      className={className}
      aria-live="polite"
      aria-label={copied ? 'Copied fetch' : 'Copy as fetch'}
      onClick={onCopy}
    >
      <Kbd hotkey="Y" />
      {copied ? 'Copied' : 'Copy as fetch'}
    </button>
  )
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
  onSaveAuth: (value: Record<string, unknown>) => Promise<void>
}) {
  const [formData, setFormData] = useState<unknown>({})
  const [lastSubmission, setLastSubmission] = useState<unknown>({})
  const [result, setResult] = useState<InvokeResult | null>(null)
  const [askingAuth, setAskingAuth] = useState(false)
  const [copied, setCopied] = useState(false)
  const [authReady, setAuthReady] = useState(!needsAuth)
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const { mode, pane } = useChrome()
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
      activate('response', 'command')
    },
  })
  const pending = invoke.isPending
  const error = invoke.isError
    ? queryErrorMessage(invoke.error, 'The request failed.')
    : null
  const showAuth = Boolean(askingAuth && needsAuth && authSchema)
  const canCopyFetch = !showAuth && (!needsAuth || authReady)

  useEffect(() => {
    setAuthReady(!needsAuth)
  }, [needsAuth])

  useEffect(() => {
    setAskingAuth(false)
    setCopied(false)
    const timer = window.setTimeout(() => selectDefaultInput('call-form'), 0)
    return () => window.clearTimeout(timer)
  }, [operation.id])

  useEffect(() => bindFormTabSync('call-form'), [operation.id])

  useEffect(() => {
    if (!showAuth) {
      return
    }
    const timer = window.setTimeout(() => insertCurrentInput('inline-auth-form'), 0)
    return () => window.clearTimeout(timer)
  }, [showAuth])

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyFetch() {
    try {
      const ok = await copyText(
        toFetch(
          buildOperationRequest({
            serverUrl,
            operation,
            formData: formDataRef.current,
            auth: readApiAuth(api.id),
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

  useHotkey(
    'Mod+Enter',
    () => {
      if (pending || authPending) {
        return
      }
      submitForm(showAuth ? 'inline-auth-form' : 'call-form')
    },
    { enabled: pane === 'form', ignoreInputs: false },
  )
  useHotkey(
    'O',
    () => activate('response', 'command'),
    { enabled: pane === 'form' && mode === 'command' && Boolean(result) },
  )
  useHotkey(
    'Y',
    () => {
      void copyFetch()
    },
    { enabled: pane === 'form' && mode === 'command' && canCopyFetch },
  )

  function onSubmit({ formData: next }: IChangeEvent) {
    setFormData(next)
    setLastSubmission(next)
    if (needsAuth) {
      setAskingAuth(true)
      return
    }
    invoke.mutate(next)
  }

  async function onAuthContinue(value: Record<string, unknown>) {
    await onSaveAuth(value)
    setAuthReady(true)
    setAskingAuth(false)
    invoke.mutate(formDataRef.current)
  }

  function showForm(insert: boolean) {
    activate('form', 'command')
    if (insert) {
      window.setTimeout(() => selectDefaultInput('call-form'), 0)
    }
  }

  if (pane === 'response' && result) {
    return (
      <div className={`api-context api-${operation.method} h-full min-h-0`}>
        <ResponsePane
          result={result}
          pending={pending}
          error={error}
          onBack={() => showForm(false)}
          onResend={() => invoke.mutate(lastSubmission)}
          onCopyFetch={
            canCopyFetch
              ? () => {
                  void copyFetch()
                }
              : undefined
          }
          copied={copied}
        />
      </div>
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
          <span
            data-oc-method-label
            className="api-ink font-mono text-xs tabular-nums"
          >
            {operation.method.toUpperCase()}
          </span>
          <span className="min-w-0 truncate font-mono text-xs text-ink">
            {operation.path}
          </span>
          {operation.deprecated ? (
            <span className="text-xs text-signal">deprecated</span>
          ) : null}
          {result ? (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-2 bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/15"
              onClick={() => activate('response', 'command')}
            >
              View output
              <Kbd hotkey="O" />
            </button>
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
              {error ? (
                <p className="text-xs text-error" role="alert">
                  {error}
                </p>
              ) : null}
              {showAuth ? null : (
                <div className="flex flex-wrap items-center gap-2">
                  {canCopyFetch ? (
                    <CopyFetchButton
                      copied={copied}
                      size="form"
                      onCopy={() => {
                        void copyFetch()
                      }}
                    />
                  ) : null}
                  <button
                    type="submit"
                    className={`${formPrimaryButtonClass} api-solid`}
                    disabled={pending}
                  >
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
              )}
            </div>
          </SwissForm>
          {showAuth && authSchema ? (
            <div className="mt-6 border-t border-rule pt-3">
              <p className="mb-3 text-sm text-ink">Sign in to send this request.</p>
              <AuthFields
                id="inline-auth-form"
                idPrefix="inline-auth"
                schema={authSchema}
                uiSchema={authUiSchema ?? {}}
                pending={authPending}
                error={authError}
                onContinue={(value) => {
                  void onAuthContinue(value)
                }}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
