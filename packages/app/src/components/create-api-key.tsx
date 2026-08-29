import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { CreateApiKeyRequest } from '@hookfish/api'

type ApiKeyExpiration = CreateApiKeyRequest['expiration']

const expirations: readonly ApiKeyExpiration[] = [
  '1 day',
  '7 days',
  '30 days',
  '90 days',
  'never',
]
import { copyText } from '../lib/clipboard'
import { createApiKey, type CreatedApiKey } from '../lib/session'
import { labelClass, primaryButtonClass, softButtonClass, softInputClass } from '../lib/ui'

export function CreateApiKeyForm({
  id = 'create-api-key-form',
}: {
  id?: string
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
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">Copy this key now. It will not be shown again.</p>
        <p className="text-xs text-mute">{created.name}</p>
        <p className="break-all bg-ink/10 px-3 py-2 font-mono text-xs text-ink">{created.key}</p>
        <div className="flex gap-2">
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
    <form id={id} className="flex flex-col" onSubmit={onSubmit}>
      <p className="text-sm text-ink">Create an API key</p>
      <label className="mt-3 block">
        <span className={labelClass}>Name</span>
        <input
          className={`${softInputClass} mt-1`}
          autoComplete="off"
          required
          maxLength={100}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>
      <label className="mt-3 block">
        <span className={labelClass}>Expiration</span>
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
      </label>
      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
      <button className={`${primaryButtonClass} mt-4 w-fit`} disabled={pending} type="submit">
        {pending ? 'Creating…' : 'Create API key'}
      </button>
    </form>
  )
}
