import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateApiKeyForm } from './create-api-key'
import { Kbd } from './hints'
import { fetchSession, signOut } from '../lib/session'

const sessionQueryKey = ['auth-session'] as const

export function AccountMenu() {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
  })
  const out = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey })
    },
  })

  const [creatingKey, setCreatingKey] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const user = session.data?.user

  useEffect(() => {
    if (!user) {
      setCreatingKey(false)
    }
  }, [user])

  useEffect(() => {
    if (!creatingKey) {
      return
    }
    function onPointerDown(event: PointerEvent) {
      if (panelRef.current?.contains(event.target as Node)) {
        return
      }
      setCreatingKey(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        setCreatingKey(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [creatingKey])

  if (session.isPending) {
    return <div className="size-8" aria-hidden="true" />
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex h-8 items-center gap-1.5 bg-ink/10 px-2 text-sm text-ink outline-none hover:bg-ink/15 focus-visible:bg-ink/15"
      >
        Sign in
        <Kbd hotkey="S" />
      </Link>
    )
  }

  return (
    <div ref={panelRef} className="relative flex min-w-0 items-center gap-1">
      <span className="max-w-40 truncate px-1 text-sm text-mute" title={user.email}>
        {user.email}
      </span>
      <button
        type="button"
        className="inline-flex h-8 items-center px-2 text-sm text-mute outline-none hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink"
        aria-expanded={creatingKey}
        onClick={() => {
          setCreatingKey((open) => !open)
        }}
      >
        {creatingKey ? 'Close' : 'Create API key'}
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center px-2 text-sm text-mute outline-none hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink disabled:opacity-40"
        disabled={out.isPending}
        onClick={() => {
          setCreatingKey(false)
          out.mutate()
        }}
      >
        {out.isPending ? 'Signing out…' : 'Sign out'}
      </button>
      {creatingKey ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 bg-ink/10 p-4">
          <CreateApiKeyForm id="account-menu-create-api-key" />
        </div>
      ) : null}
    </div>
  )
}
