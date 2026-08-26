import { useState } from 'react'
import validator from '@rjsf/validator-ajv8'
import type { IChangeEvent } from '@rjsf/core'
import type { FormUiSchema, JsonSchema } from '../lib/client-types'
import { asRecord } from '../lib/build-request'
import { queryErrorMessage } from '../lib/queries'
import { formPrimaryButtonClass } from '../lib/ui'
import { Kbd } from './hints'
import { SwissForm } from './swiss-form'

export function AuthFields({
  id = 'auth-form',
  idPrefix = 'auth',
  schema,
  uiSchema,
  stored,
  pending,
  error,
  onContinue,
  onClear,
}: {
  id?: string
  idPrefix?: string
  schema: JsonSchema
  uiSchema: FormUiSchema
  stored?: boolean
  pending?: boolean
  error?: unknown
  onContinue: (value: Record<string, unknown>) => void | Promise<void>
  onClear?: () => void
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  return (
    <SwissForm
      id={id}
      idPrefix={idPrefix}
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
      <div className="flex flex-col gap-2 pt-3">
        {error ? (
          <p className="text-xs text-error" role="alert">
            {queryErrorMessage(error, 'Could not save those keys.')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className={`${formPrimaryButtonClass} api-solid`}
            disabled={pending}
          >
            {pending ? (
              'Saving…'
            ) : (
              <>
                <span className="mr-2 inline-flex gap-1">
                  <Kbd hotkey="Mod" />
                  <Kbd hotkey="Enter" />
                </span>
                Continue
              </>
            )}
          </button>
          {stored && onClear ? (
            <button
              type="button"
              className="inline-flex min-h-8 items-center justify-center gap-2 bg-ink/10 px-3 py-1 text-xs font-medium text-ink hover:bg-ink/15 outline-none disabled:cursor-not-allowed disabled:opacity-40"
              disabled={pending}
              onClick={onClear}
            >
              Clear
              <Kbd hotkey="Mod+Backspace" />
            </button>
          ) : null}
        </div>
      </div>
    </SwissForm>
  )
}
