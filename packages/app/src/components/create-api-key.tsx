import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { CreateApiKeyRequest } from '@hookfish/api'
import { Kbd } from './hints'
import { copyText } from '../lib/clipboard'
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
}: {
  id?: string
  onCreatedChange?: (created: boolean) => void
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

  function onReset() {
    setCreated(null)
    setCopied(false)
    create.reset()
    onCreatedChange?.(false)
  }

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
      onReset={onReset}
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
  onReset,
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
  onReset: () => void
}) {
  if (created) {
    return (
      <div className="mt-8 flex flex-col">
        <p className="text-sm text-mute">Copy this key now. It will not be shown again.</p>
        <p className="mt-4 text-sm text-ink">{created.name}</p>
        <p className="mt-3 break-all bg-ink/5 px-3 py-2.5 font-mono text-sm text-ink">{created.key}</p>
        <div className="mt-6 flex gap-2">
          <button type="button" className={primaryButtonClass} onClick={onCopy}>
            {copied ? 'Copied' : 'Copy key'}
          </button>
          <button type="button" className={softButtonClass} onClick={onReset}>
            Create another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form id={id} className="mt-8" data-oc-enter-submit="true" onSubmit={onSubmit}>
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
      <button className={`${primaryButtonClass} mt-6 w-fit`} disabled={pending} type="submit">
        {pending ? 'Creating…' : 'Create API key'}
      </button>
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
