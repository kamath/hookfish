import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Kbd, KeyHints } from '../components/hints'
import {
  bindFormTabSync,
  selectDefaultFormItem,
  useFormPaneNavigation,
} from '../lib/form-nav'
import { submitForm } from '../lib/focus'
import { usePaneActions, usePaneFlags } from '../lib/keys'
import { activate } from '../lib/mode'
import { fetchSession, signIn, signUp } from '../lib/session'
import { useSourceToolbar } from '../lib/toolbar'
import {
  labelClass,
  primaryButtonClass,
  softButtonClass,
  softInputClass,
} from '../lib/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const session = useQuery({
    queryKey: ['auth-session'],
    queryFn: fetchSession,
  })

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === 'sign-up') {
        return signUp({ name, email, password })
      }
      return signIn({ email, password })
    },
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] })
    },
    onError: (caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    },
  })

  const user = session.data?.user
  const signedIn = Boolean(user)

  function goBack() {
    void navigate({ to: '/' })
  }

  useEffect(() => {
    activate('login', 'command')
  }, [])

  useSourceToolbar({
    title: signedIn ? 'Signed in' : mode === 'sign-up' ? 'Create an account' : 'Sign in',
    backLabel: 'Sources',
    onBack: goBack,
  })

  usePaneFlags('login', {
    canEdit: !signedIn,
    signedIn,
  })

  useFormPaneNavigation('login', 'login-form')

  usePaneActions('login', {
    parent: goBack,
    submitNow: {
      callback: () => submitForm('login-form'),
      enabled: !signedIn && !submit.isPending,
      ignoreInputs: false,
    },
    switchAuthMode: {
      callback: () => {
        setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'))
        setError(null)
      },
      enabled: !signedIn,
    },
    continue: goBack,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => selectDefaultFormItem('login-form'), 0)
    const unbind = bindFormTabSync('login-form')
    return () => {
      window.clearTimeout(timer)
      unbind()
    }
  }, [signedIn, mode])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (signedIn) {
      goBack()
      return
    }
    setError(null)
    submit.mutate()
  }

  if (user) {
    return (
      <main
        id="login-pane"
        className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-6 py-12"
      >
        <h1 className="text-3xl font-normal md:text-5xl">Signed in</h1>
        <p className="mt-4 text-sm text-mute">Using {user.email}.</p>
        <form id="login-form" className="mt-8" onSubmit={onSubmit}>
          <button className={`${primaryButtonClass} w-fit`} type="submit">
            Continue
            <KeyHints className="ml-2">
              <Kbd hotkey="Enter" />
            </KeyHints>
          </button>
        </form>
      </main>
    )
  }

  return (
    <main
      id="login-pane"
      className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-6 py-12"
    >
      <h1 className="text-3xl font-normal md:text-5xl">
        {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
      </h1>
      <form
        id="login-form"
        data-oc-enter-submit="true"
        onSubmit={onSubmit}
      >
        {mode === 'sign-up' ? (
          <Field label="Name" className="mt-6">
            <input
              className={`${softInputClass} mt-1`}
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Email" className={mode === 'sign-up' ? 'mt-4' : 'mt-6'}>
          <input
            className={`${softInputClass} mt-1`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" className="mt-4">
          <input
            className={`${softInputClass} mt-1`}
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            data-oc-nav="action"
            className={`${softButtonClass} flex-1`}
            onClick={goBack}
          >
            <Kbd hotkey="Escape" />
            Cancel
          </button>
          <button
            className={`${primaryButtonClass} flex-1`}
            disabled={submit.isPending}
            type="submit"
          >
            {submit.isPending ? (
              mode === 'sign-in' ? (
                'Signing in…'
              ) : (
                'Creating account…'
              )
            ) : (
              <>
                <KeyHints className="mr-2 inline-flex gap-1">
                  <Kbd hotkey="Enter" />
                </KeyHints>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          data-oc-nav="action"
          className="mt-6 inline-flex items-center gap-2 text-left text-sm text-mute outline-none hover:text-ink"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
          }}
        >
          {mode === 'sign-in' ? 'Need an account? Create one' : 'Have an account? Sign in'}
          <KeyHints>
            <Kbd hotkey="C" />
          </KeyHints>
        </button>
      </form>
    </main>
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
