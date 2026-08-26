import { useEffect, useState } from 'react'
import validator from '@rjsf/validator-ajv8'
import { useHotkeys } from '@tanstack/react-hotkeys'
import type { IChangeEvent } from '@rjsf/core'
import type { FormUiSchema, JsonSchema } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import { bindFormTabSync, confirmForm, exitInsert, insertCurrentInput, isTypingInCurrentField, moveFormTab, selectDefaultInput } from '../lib/form-nav'
import { commandHotkey, useStepKeys } from '../lib/keys'
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

  useEffect(() => {
    const timer = window.setTimeout(() => selectDefaultInput('auth-form'), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => bindFormTabSync('auth-form'), [])

  useStepKeys((delta) => {
    moveFormTab('auth-form', delta)
  })

  useHotkeys([
    {
      hotkey: 'Mod+Enter',
      callback: () => {
        if (!pending) {
          void onContinue(formData)
        }
      },
      options: { ignoreInputs: false },
    },
    {
      hotkey: 'I',
      callback: (event) => {
        if (isTypingInCurrentField('auth-form')) {
          return
        }
        event.preventDefault()
        insertCurrentInput('auth-form')
      },
      options: commandHotkey,
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
      callback: (event) => {
        if (document.activeElement instanceof HTMLTextAreaElement) {
          return
        }
        event.preventDefault()
        confirmForm('auth-form')
      },
      options: commandHotkey,
    },
    {
      hotkey: 'Escape',
      callback: (event) => {
        event.preventDefault()
        if (exitInsert('auth-form')) {
          return
        }
        onLeave()
      },
      options: commandHotkey,
    },
    {
      hotkey: 'Backspace',
      callback: () => {
        onLeave()
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
        items={[
          { hotkey: 'Mod+Enter', label: 'continue' },
          { hotkey: 'J', label: 'next input' },
          { hotkey: 'K', label: 'previous input' },
          { hotkey: 'I', label: 'insert' },
          { hotkey: 'Backspace', label: 'back' },
          { hotkey: 'Escape', label: 'leave or specs' },
        ]}
      />
    </main>
  )
}
