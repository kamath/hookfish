import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

  const user = session.data?.user
  if (session.isPending) {
    return <div className="size-8" aria-hidden="true" />
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex h-8 items-center px-2 text-sm text-mute outline-none hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="max-w-40 truncate px-1 text-sm text-mute" title={user.email}>
        {user.email}
      </span>
      <button
        type="button"
        className="inline-flex h-8 items-center px-2 text-sm text-mute outline-none hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink disabled:opacity-40"
        disabled={out.isPending}
        onClick={() => {
          out.mutate()
        }}
      >
        {out.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
