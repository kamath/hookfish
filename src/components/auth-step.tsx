import { useEffect, useState } from 'react'
import validator from '@rjsf/validator-ajv8'
import { useHotkeys } from '@tanstack/react-hotkeys'
import type { IChangeEvent } from '@rjsf/core'
import type { FormUiSchema, JsonSchema } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import { blurActive, isEditing } from '../lib/focus'
import { activateFocusedControl, focusFirstInput, moveInputTab } from '../lib/form-nav'
import { repeatHotkey, useRepeatDelta } from '../lib/repeat'
import { primaryButtonClass } from '../lib/ui'
import { HintBar } from './hints'
import { SwissForm } from './swiss-form'

export function AuthStep({
  title,
  schema,
  uiSchema,
  stored,
  onContinue,
  onLeave,
}: {
  title: string
  schema: JsonSchema
  uiSchema: FormUiSchema
  stored?: boolean
  onContinue: (value: Record<string, unknown>) => void | Promise<void>
  onLeave: () => void
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const field = document.querySelector<HTMLInputElement>(
        '#auth-form input, #auth-form textarea',
      )
      field?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const nudge = useRepeatDelta((delta) => {
    moveInputTab('auth-form', delta)
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
      callback: () => {
        focusFirstInput('auth-form')
      },
    },
    {
      hotkey: 'J',
      callback: () => {
        nudge(1)
      },
      options: { ...repeatHotkey, ignoreInputs: false },
    },
    {
      hotkey: 'K',
      callback: () => {
        nudge(-1)
      },
      options: { ...repeatHotkey, ignoreInputs: false },
    },
    {
      hotkey: 'Enter',
      callback: () => {
        activateFocusedControl()
      },
    },
    {
      hotkey: 'Escape',
      callback: () => {
        if (isEditing()) {
          blurActive()
          return
        }
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

  return (
    <main id="main" className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col px-3 py-8 md:px-4">
      <p className="text-sm text-mute">{title}</p>
      <p className="mt-2 text-sm text-ink">
        {stored ? 'Replace a stored key, or leave a field blank to keep it.' : 'Sign in to the API first.'}
      </p>
      <p className="mt-1 text-xs text-mute">Keys stay on the server.</p>
      <div className="mt-8 flex-1">
        <SwissForm
          id="auth-form"
          idPrefix="auth"
          schema={schema as never}
          uiSchema={uiSchema as never}
          validator={validator}
          formData={formData}
          onChange={(event: IChangeEvent) => setFormData(asRecord(event.formData))}
          onSubmit={({ formData: next }) => {
            setPending(true)
            void Promise.resolve(onContinue(asRecord(next))).finally(() => {
              setPending(false)
            })
          }}
          showErrorList={false}
          omitExtraData
        >
          <button type="submit" className={primaryButtonClass} disabled={pending}>
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
