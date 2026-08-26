import { useEffect } from 'react'
import type { FormUiSchema, JsonSchema } from '../lib/client-types'
import {
  bindFormTabSync,
  insertCurrentInput,
  useFormPaneNavigation,
} from '../lib/form-nav'
import { usePaneHotkeys } from '../lib/keys'
import { activate, useChrome } from '../lib/mode'
import { submitForm } from '../lib/focus'
import { HintBar } from './hints'
import { AuthFields } from './auth-fields'

export function AuthStep({
  title,
  schema,
  uiSchema,
  stored,
  pending,
  error,
  onContinue,
  onClear,
  onLeave,
}: {
  title: string
  schema: JsonSchema
  uiSchema: FormUiSchema
  stored?: boolean
  pending?: boolean
  error?: unknown
  onContinue: (value: Record<string, unknown>) => void | Promise<void>
  onClear?: () => void
  onLeave: () => void
}) {
  const { mode } = useChrome()
  const canClear = Boolean(stored && onClear)

  useEffect(() => {
    activate('auth', 'edit')
    const timer = window.setTimeout(() => insertCurrentInput('auth-form'), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => bindFormTabSync('auth-form'), [])

  useFormPaneNavigation('auth', 'auth-form')

  usePaneHotkeys('auth', ['command', 'edit'], [
    {
      hotkey: 'Mod+Enter',
      callback: () => {
        if (!pending) {
          submitForm('auth-form')
        }
      },
      options: { ignoreInputs: false },
    },
    {
      hotkey: 'Mod+Backspace',
      callback: () => {
        if (!pending) {
          onClear?.()
        }
      },
      options: { enabled: canClear, ignoreInputs: false },
    },
  ])

  usePaneHotkeys('auth', ['command'], [
    {
      hotkey: 'A',
      callback: () => {
        onLeave()
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-paper">
      <div className="sticky top-0 z-10 flex items-baseline gap-3 border-b border-rule bg-paper px-3 py-2 md:px-4">
        <span className="min-w-0 truncate text-sm text-ink">{title}</span>
        <span className="min-w-0 truncate text-xs text-mute">
          {stored
            ? 'Replace a stored key, or leave a field blank to keep it.'
            : 'Sign in to the API first. Keys stay on this device.'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
        <AuthFields
          schema={schema}
          uiSchema={uiSchema}
          stored={stored}
          pending={pending}
          error={error}
          onContinue={onContinue}
          onClear={onClear}
        />
      </div>
      <HintBar
        items={
          mode === 'edit'
            ? [
                { hotkey: 'Mod+Enter', label: 'continue' },
                ...(canClear ? [{ hotkey: 'Mod+Backspace', label: 'clear' }] : []),
                { hotkey: 'Escape', label: 'command' },
              ]
            : [
                { hotkey: 'J', label: 'next' },
                { hotkey: 'K', label: 'previous' },
                { hotkey: 'I', label: 'insert' },
                { hotkey: 'Enter', label: 'expand' },
                { hotkey: 'Mod+Enter', label: 'continue' },
                ...(canClear ? [{ hotkey: 'Mod+Backspace', label: 'clear' }] : []),
                { hotkey: 'A', label: 'close' },
                { hotkey: 'Escape', label: 'back' },
                { hotkey: 'Backspace', label: 'back' },
              ]
        }
      />
    </div>
  )
}
