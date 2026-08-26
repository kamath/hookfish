import { useEffect, useState } from 'react'
import validator from '@rjsf/validator-ajv8'
import type { IChangeEvent } from '@rjsf/core'
import type { FormUiSchema, JsonSchema } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import {
  bindFormTabSync,
  confirmForm,
  exitInsert,
  insertCurrentInput,
  moveFormTab,
  selectDefaultInput,
} from '../lib/form-nav'
import { useEditHotkeys, usePaneHotkeys, useStepKeys } from '../lib/keys'
import { activate, useChrome } from '../lib/mode'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { HintBar } from './hints'
import { SwissForm } from './swiss-form'

export function AuthStep({
  title,
  schema,
  uiSchema,
  stored,
  pending,
  error,
  onContinue,
  onLeave,
}: {
  title: string
  schema: JsonSchema
  uiSchema: FormUiSchema
  stored?: boolean
  pending?: boolean
  error?: unknown
  onContinue: (value: Record<string, unknown>) => void | Promise<void>
  onLeave: () => void
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const { mode } = useChrome()

  useEffect(() => {
    activate('auth', 'command')
    const timer = window.setTimeout(() => selectDefaultInput('auth-form'), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => bindFormTabSync('auth-form'), [])

  useStepKeys((delta) => {
    moveFormTab('auth-form', delta)
  })

  usePaneHotkeys('auth', ['command', 'edit'], [
    {
      hotkey: 'Mod+Enter',
      callback: () => {
        if (!pending) {
          void onContinue(formData)
        }
      },
      options: { ignoreInputs: false },
    },
  ])

  usePaneHotkeys('auth', ['command'], [
    {
      hotkey: 'I',
      callback: () => {
        insertCurrentInput('auth-form')
      },
    },
    {
      hotkey: { key: 'Tab' },
      callback: () => {
        moveFormTab('auth-form', 1)
      },
    },
    {
      hotkey: { key: 'Tab', shift: true },
      callback: () => {
        moveFormTab('auth-form', -1)
      },
    },
    {
      hotkey: 'Enter',
      callback: () => {
        confirmForm('auth-form')
      },
    },
    {
      hotkey: 'Escape',
      callback: () => {
        onLeave()
      },
    },
    {
      hotkey: 'Backspace',
      callback: () => {
        onLeave()
      },
    },
  ])

  useEditHotkeys([
    {
      hotkey: 'Escape',
      callback: (event) => {
        event.preventDefault()
        exitInsert('auth-form')
      },
    },
  ])

  return (
    <main id="main" className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden px-3 py-8 md:px-4">
      <p className="text-sm text-mute">{title}</p>
      <p className="mt-2 text-sm text-ink">
        {stored ? 'Replace a stored key, or leave a field blank to keep it.' : 'Sign in to the API first.'}
      </p>
      <p className="mt-1 text-xs text-mute">Keys stay on the server.</p>
      <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
        <SwissForm
          id="auth-form"
          idPrefix="auth"
          schema={schema as never}
          uiSchema={uiSchema as never}
          validator={validator}
          formData={formData}
          onChange={(event: IChangeEvent) => setFormData(asRecord(event.formData))}
          onSubmit={({ formData: next }) => {
            void onContinue(asRecord(next))
          }}
          showErrorList={false}
          omitExtraData
        >
          {error ? (
            <p className="mb-3 text-xs text-signal" role="alert">
              {queryErrorMessage(error, 'Could not save those keys.')}
            </p>
          ) : null}
          <button type="submit" className={formPrimaryButtonClass} disabled={pending}>
            {pending ? 'Saving…' : 'Continue'}
          </button>
        </SwissForm>
      </div>
      <HintBar
        items={
          mode === 'edit'
            ? [
                { hotkey: 'Mod+Enter', label: 'continue' },
                { hotkey: 'Escape', label: 'command' },
              ]
            : [
                { hotkey: 'Mod+Enter', label: 'continue' },
                { hotkey: 'J', label: 'next input' },
                { hotkey: 'K', label: 'previous input' },
                { hotkey: 'I', label: 'insert' },
                { hotkey: 'Backspace', label: 'back' },
                { hotkey: 'Escape', label: 'specs' },
              ]
        }
      />
    </main>
  )
}
