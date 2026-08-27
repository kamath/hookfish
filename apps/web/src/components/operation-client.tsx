import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { atom, useAtom } from 'jotai'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { IChangeEvent } from '@rjsf/core'
import type {
  Executable,
  ExecutableSource,
  FormUiSchema,
  ExecutionResult,
  JsonSchema,
} from '../lib/client-types'
import { fieldsFromForm, readApiAuth } from '../lib/auth'
import { asRecord } from '../lib/build-request'
import { copyText } from '../lib/clipboard'
import { executableAdapterFor } from '../lib/executable-adapters'
import { withAuthPlaceholders } from '../lib/export-snippet'
import { bindFormTabSync, selectDefaultFormItem, selectMatchingFormItem } from '../lib/form-nav'
import { validatorForSchema } from '../lib/form-validator'
import { blurActive, submitForm } from '../lib/focus'
import { usePaneActions, usePaneFlags } from '../lib/keys'
import { activate, enterCommand, usePane } from '../lib/mode'
import { readOperationFormData, writeOperationFormData } from '../lib/operation-form-cache'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'
import { PaneBackButton } from './pane-back-button'
import { ResponsePane } from './response-pane'
import { SwissForm } from './swiss-form'

const AUTH_NOTICE = 'This execution requires credentials.'
const inspectRouteAtom = atom(false)

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

const stepButtonClass =
  'inline-flex min-h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap bg-ink/10 px-2 py-1 text-xs text-mute hover:text-ink outline-none disabled:cursor-not-allowed disabled:opacity-40 md:flex-none lg:hidden'

export function ExecutableClient({
  api,
  operation,
  target,
  needsAuth,
  authSchema,
  authUiSchema,
  authPending,
  authError,
  onSaveAuth,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onBack,
  backLabel,
}: {
  api: ExecutableSource
  operation: Executable
  target: string
  needsAuth: boolean
  authSchema?: JsonSchema
  authUiSchema?: FormUiSchema
  authPending?: boolean
  authError?: unknown
  onSaveAuth: (value: Record<string, unknown>) => Promise<void>
  canPrevious?: boolean
  canNext?: boolean
  onPrevious?: () => void
  onNext?: () => void
  onBack?: () => void
  backLabel?: string
}) {
  const [formData, setFormData] = useState<unknown>(() =>
    readOperationFormData(api.id, operation.id),
  )
  const [lastSubmission, setLastSubmission] = useState<unknown>({})
  const [lastInvocation, setLastInvocation] = useState<unknown>()
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [askingAuth, setAskingAuth] = useState(false)
  const [copied, setCopied] = useState(false)
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const pane = usePane()
  const [inspecting, setInspecting] = useAtom(inspectRouteAtom)
  const navigate = useNavigate()
  const adapter = executableAdapterFor(api)
  const invoke = useMutation({
    mutationFn: ({
      invocation,
      continuation,
    }: {
      invocation: unknown
      continuation?: {
        inputResponses: Record<string, unknown>
        requestState?: string
      }
    }) =>
      continuation && adapter.continue
        ? adapter.continue(
            invocation,
            continuation.inputResponses,
            continuation.requestState,
          )
        : adapter.execute(invocation),
    onSuccess: (nextResult) => {
      setResult(nextResult)
      showResponse()
    },
  })
  const pending = invoke.isPending
  const error = invoke.isError ? queryErrorMessage(invoke.error, 'The execution failed.') : null
  const showAuth = Boolean(askingAuth && needsAuth && authSchema)

  useEffect(() => {
    setAskingAuth(false)
    setCopied(false)
    if (inspecting) {
      return
    }
    const timer = window.setTimeout(() => selectDefaultFormItem('call-form'), 0)
    return () => window.clearTimeout(timer)
  }, [inspecting, operation.id])

  useEffect(() => {
    if (!inspecting) {
      return bindFormTabSync('call-form')
    }
  }, [inspecting, operation.id])

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

  async function copyExport() {
    if (!adapter.exportSnippet) {
      return
    }
    try {
      const data = asRecord(formDataRef.current)
      const ok = await copyText(
        adapter.exportSnippet(
          adapter.buildInvocation({
            source: api,
            executable: operation,
            target,
            formData: withoutAuth(data),
            credentials: withAuthPlaceholders(
              mergeAuth(readApiAuth(api.id), fieldsFromForm(data.auth)),
              Object.keys(asRecord(authSchema?.properties)),
            ),
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

  function toggleInspect() {
    blurActive()
    enterCommand()
    setInspecting((current) => !current)
  }

  usePaneFlags('input', {
    hasResult: Boolean(result),
    hasExport: !inspecting && Boolean(adapter.exportSnippet && api.labels.export),
  })
  usePaneActions('input', {
    send: {
      callback: () => {
        if (inspecting || pending || authPending) {
          return
        }
        submitForm('call-form')
      },
      enabled: !inspecting,
      ignoreInputs: false,
    },
    output: () => showResponse(),
    export: () => {
      void copyExport()
    },
    inspect: toggleInspect,
  })
  usePaneActions('response', {
    parent: () => showInput(false),
  })

  function updateFormData(next: unknown) {
    formDataRef.current = next
    writeOperationFormData(api.id, operation.id, next)
    setFormData(next)
  }

  function onSubmit({ formData: next }: IChangeEvent) {
    updateFormData(next)
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
    executeForm(request)
  }

  async function onAuthContinue(value: Record<string, unknown>, request: unknown) {
    await onSaveAuth(value)
    setAskingAuth(false)
    executeForm(request)
  }

  function executeForm(value: unknown) {
    const invocation = adapter.buildInvocation({
      source: api,
      executable: operation,
      target,
      formData: value,
      credentials: readApiAuth(api.id),
    })
    setLastInvocation(invocation)
    invoke.mutate({ invocation })
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
      <div
        className="exec-context h-full min-h-0"
        style={{ '--exec-color': operation.accent } as CSSProperties}
      >
        <ResponsePane
          result={result}
          pending={pending}
          error={error}
          onBack={() => showInput(false)}
          onResend={() => executeForm(lastSubmission)}
          executeLabel={api.labels.executed}
          executingLabel={api.labels.executing}
          onContinue={
            result.inputRequired && lastInvocation && adapter.continue
              ? (inputResponses) =>
                  invoke.mutate({
                    invocation: lastInvocation,
                    continuation: {
                      inputResponses,
                      requestState: result.inputRequired?.requestState,
                    },
                  })
              : undefined
          }
        />
      </div>
    )
  }

  if (pane === 'response') {
    return (
      <section className="flex h-full min-h-0 items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm text-mute">No result is available in this session.</p>
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
      data-oc-executable
      className="exec-context h-full min-h-0 overflow-hidden"
      style={{ '--exec-color': operation.accent } as CSSProperties}
    >
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
        <div className="oc-bar sticky top-0 z-10 flex flex-col gap-2 overflow-hidden px-3 py-2 md:flex-row md:items-center md:gap-3 md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            {onBack ? (
              <PaneBackButton label={backLabel ?? 'Back'} onClick={onBack} />
            ) : null}
            <div className="flex min-w-0 items-baseline gap-3">
              <span data-oc-executable-badge className="exec-ink font-mono text-xs tabular-nums">
                {operation.badge}
              </span>
              <span className="min-w-0 truncate font-mono text-xs text-ink">{operation.name}</span>
              {operation.deprecated ? <span className="text-xs text-signal">deprecated</span> : null}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto [&>button]:max-md:min-w-[calc(50%-0.25rem)]">
            {onPrevious || onNext ? (
              <>
                <button
                  type="button"
                  className={stepButtonClass}
                  disabled={!canPrevious}
                  onClick={onPrevious}
                >
                  Previous
                  {canPrevious ? <Kbd hotkey="H" /> : null}
                </button>
                <button
                  type="button"
                  className={stepButtonClass}
                  disabled={!canNext}
                  onClick={onNext}
                >
                  Next
                  {canNext ? <Kbd hotkey="L" /> : null}
                </button>
              </>
            ) : null}
            {result ? (
              <button
                type="button"
                className="inline-flex min-h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap bg-ink/10 px-2 py-1 text-xs font-medium text-ink hover:bg-ink/15 md:flex-none"
                onClick={showResponse}
              >
                View output
                <Kbd hotkey="O" />
              </button>
            ) : null}
            <button
              type="button"
              aria-pressed={inspecting}
              className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 px-3 py-1 text-xs font-medium outline-none md:flex-none ${
                inspecting
                  ? 'exec-solid'
                  : 'bg-ink/10 text-mute hover:bg-ink/15 hover:text-ink'
              }`}
              onClick={toggleInspect}
            >
              {inspecting ? 'Call' : 'Inspect'}
              <KeyHints>
                <Kbd hotkey="V" />
              </KeyHints>
            </button>
            {inspecting ? null : adapter.exportSnippet && api.labels.export ? (
              <button
                type="button"
                data-oc-nav="action"
                className="inline-flex min-h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap bg-ink/10 px-3 py-1 text-xs font-medium text-ink hover:bg-ink/15 outline-none md:flex-none"
                aria-live="polite"
                aria-label={copied ? (api.labels.exported ?? 'Copied') : api.labels.export}
                onClick={() => {
                  void copyExport()
                }}
              >
                {copied ? 'Copied' : api.labels.export}
                <KeyHints>
                  <Kbd hotkey="Y" />
                </KeyHints>
              </button>
            ) : null}
            {inspecting ? null : (
            <button
              type="button"
              data-oc-nav="action"
              className={`${formPrimaryButtonClass} exec-solid flex-1 whitespace-nowrap md:flex-none`}
              disabled={pending || authPending}
              onClick={() => submitForm('call-form')}
            >
              {pending ? (
                api.labels.executing
              ) : authPending ? (
                'Saving…'
              ) : (
                <>
                  <KeyHints className="mr-2 inline-flex gap-1">
                    <Kbd hotkey="Mod" />
                    <Kbd hotkey="Enter" />
                  </KeyHints>
                  {showAuth ? 'Continue' : api.labels.execute}
                </>
              )}
            </button>
            )}
          </div>
        </div>

        {inspecting ? (
          <ResponsePane
            result={{
              body: operation.outputSchema ? JSON.stringify(operation.outputSchema) : '',
              elapsedMs: 0,
            }}
            pending={false}
            error={null}
            pane="input"
            inspection={{
              summary: operation.summary,
              description: operation.description,
              hasOutputSchema: Boolean(operation.outputSchema),
            }}
          />
        ) : (
        <div className="px-3 py-3 md:px-4">
          <SwissForm
            id="call-form"
            schema={
              (showAuth && authSchema
                ? withAuthSchema(operation.inputSchema, authSchema)
                : operation.inputSchema) as never
            }
            uiSchema={
              (showAuth && authSchema
                ? withAuthUiSchema(operation.inputUiSchema, authUiSchema)
                : operation.inputUiSchema) as never
            }
            validator={validatorForSchema(
              showAuth && authSchema
                ? withAuthSchema(operation.inputSchema, authSchema)
                : operation.inputSchema,
            )}
            formData={formData}
            onChange={(event: IChangeEvent) => updateFormData(event.formData)}
            onSubmit={onSubmit}
            showErrorList={false}
            omitExtraData
            idPrefix={operation.id}
          >
            <div className="flex flex-col gap-2 pt-3">
              <KeyHints className="inline-flex items-center gap-1 text-sm text-ink">
                <Kbd hotkey="Mod+Enter" /> to run
              </KeyHints>
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
            </div>
          </SwissForm>
        </div>
        )}
      </section>
    </div>
  )
}
