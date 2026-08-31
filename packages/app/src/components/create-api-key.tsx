import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { CreateApiKeyRequest } from '@hookfish/api'
import { Kbd, KeyHints } from './hints'
import { copyText } from '../lib/clipboard'
import { usePaneActions } from '../lib/keys'
import { createApiKey, type CreatedApiKey } from '../lib/session'
import { labelClass, primaryButtonClass, softButtonClass, softInputClass } from '../lib/ui'

type ApiKeyExpiration = CreateApiKeyRequest['expiration']

const expirations: readonly ApiKeyExpiration[] = [
  '1 day',
  '7 days',
  '30 days',
  '90 days',
  'never',
]

export function CreateApiKeyForm({
  id = 'create-api-key-form',
  onCreatedChange,
  onCancel,
}: {
  id?: string
  onCreatedChange?: (created: boolean) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [expiration, setExpiration] = useState<ApiKeyExpiration>('30 days')
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useMutation({
    mutationFn: () => createApiKey({ name: name.trim(), expiration }),
    onSuccess: (apiKey) => {
      setCreated(apiKey)
      setCopied(false)
      setName('')
      onCreatedChange?.(true)
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (created || create.isPending) {
      return
    }
    create.mutate()
  }

  async function onCopy() {
    if (!created) {
      return
    }
    setCopied(await copyText(created.key))
  }

  usePaneActions('apiKeys', {
    copy: {
      callback: () => {
        void onCopy()
      },
      enabled: Boolean(created),
    },
  })

  return (
    <CreateApiKeyView
      id={id}
      name={name}
      expiration={expiration}
      pending={create.isPending}
      error={
        create.error instanceof Error
          ? create.error.message
          : create.error
            ? 'Could not create the API key.'
            : null
      }
      created={created}
      copied={copied}
      onNameChange={setName}
      onExpirationChange={setExpiration}
      onSubmit={onSubmit}
      onCopy={() => {
        void onCopy()
      }}
      onCancel={onCancel}
    />
  )
}

export function CreateApiKeyView({
  id,
  name,
  expiration,
  pending,
  error,
  created,
  copied,
  onNameChange,
  onExpirationChange,
  onSubmit,
  onCopy,
  onCancel,
}: {
  id: string
  name: string
  expiration: ApiKeyExpiration
  pending: boolean
  error: string | null
  created: CreatedApiKey | null
  copied: boolean
  onNameChange: (value: string) => void
  onExpirationChange: (value: ApiKeyExpiration) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCopy: () => void
  onCancel: () => void
}) {
  if (created) {
    return (
      <div className="mt-8 flex flex-col">
        <p className="text-sm text-mute">Copy this key now. It will not be shown again.</p>
        <p className="mt-4 text-sm text-ink">{created.name}</p>
        <p className="mt-3 break-all bg-ink/5 px-3 py-2.5 font-mono text-sm text-ink">{created.key}</p>
        <div className="mt-6 flex gap-2">
          <button type="button" className={`${softButtonClass} flex-1`} onClick={onCancel}>
            <Kbd hotkey="Escape" />
            Back
          </button>
          <button type="button" className={`${primaryButtonClass} flex-1`} onClick={onCopy}>
            <Kbd hotkey="Y" />
            {copied ? 'Copied' : 'Copy key'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form id={id} className="mt-8" onSubmit={onSubmit}>
      <Field label="Name">
        <input
          className={`${softInputClass} mt-1`}
          autoComplete="off"
          required
          maxLength={100}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </Field>
      <Field label="Expiration" className="mt-4">
        <select
          className={`${softInputClass} mt-1`}
          value={expiration}
          onChange={(event) => onExpirationChange(event.target.value as ApiKeyExpiration)}
        >
          {expirations.map((value) => (
            <option key={value} value={value}>
              {value === 'never' ? 'Never' : value}
            </option>
          ))}
        </select>
      </Field>
      {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          data-oc-nav="action"
          className={`${softButtonClass} flex-1`}
          onClick={onCancel}
        >
          <Kbd hotkey="Escape" />
          Cancel
        </button>
        <button className={`${primaryButtonClass} flex-1`} disabled={pending} type="submit">
          {pending ? (
            'Creating…'
          ) : (
            <>
              <KeyHints className="mr-2 inline-flex gap-1">
                <Kbd hotkey="Mod+Enter" />
              </KeyHints>
              Create API key
            </>
          )}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={`block px-3 py-2.5 ${className ?? ''}`}
      data-oc-nav="field"
      data-oc-required="true"
    >
      <span className={labelClass}>{label}</span>
      {children}
      <span data-oc-hint="insert" className="mt-1 items-center gap-1.5 text-xs text-faint">
        <Kbd hotkey="I" />
        to focus input
      </span>
      <span data-oc-hint="escape" className="mt-1 items-center gap-1.5 text-xs text-faint">
        <Kbd hotkey="Escape" />
        to activate keybindings
      </span>
    </label>
  )
}
