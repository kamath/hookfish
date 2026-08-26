import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import validator from '@rjsf/validator-ajv8'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { IChangeEvent } from '@rjsf/core'
import type { ClientApi, ClientOperation, FormUiSchema, InvokeResult, JsonSchema } from '../lib/client-types'
import { asRecord, buildRequestUrl, omitEmpty } from '../lib/build-request'
import { bindFormTabSync, insertMatchingInput, selectDefaultInput } from '../lib/form-nav'
import { submitForm } from '../lib/focus'
import { activate, useChrome } from '../lib/mode'
import { readApiAuth } from '../lib/auth'
import { buildOperationRequest } from '../lib/invoke'
import { executeRequest } from '../lib/invoke.functions'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { Kbd } from './hints'
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

  useEffect(() => {
    setAskingAuth(false)
    const timer = window.setTimeout(() => selectDefaultInput('call-form'), 0)
    return () => window.clearTimeout(timer)
  }, [operation.id])

  useEffect(() => bindFormTabSync('call-form'), [operation.id])

  useEffect(() => {
    if (!showAuth) {
      return
    }
    const timer = window.setTimeout(
      () =>
        insertMatchingInput('call-form', (item) => {
          const prefix = `${operation.id}_auth`
          return item.id === prefix || item.id.startsWith(`${prefix}_`)
        }),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [operation.id, showAuth])

  useHotkey(
    'Mod+Enter',
    () => {
      if (pending || authPending) {
        return
      }
      submitForm('call-form')
    },
    { enabled: pane === 'form', ignoreInputs: false },
  )
  useHotkey(
    'O',
    () => activate('response', 'command'),
    { enabled: pane === 'form' && mode === 'command' && Boolean(result) },
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
                    <span className="mr-2 inline-flex gap-1">
                      <Kbd hotkey="Mod" />
                      <Kbd hotkey="Enter" />
                    </span>
                    {showAuth ? 'Continue' : 'Send'}
                  </>
                )}
              </button>
            </div>
          </SwissForm>
        </div>
      </section>
    </div>
  )
}
