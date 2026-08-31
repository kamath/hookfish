import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CreateApiKeyForm } from '../components/create-api-key'
import {
  bindFormTabSync,
  selectDefaultFormItem,
  useFormPaneNavigation,
} from '../lib/form-nav'
import { submitForm } from '../lib/focus'
import { usePaneActions, usePaneFlags } from '../lib/keys'
import { activate } from '../lib/mode'
import { fetchSession } from '../lib/session'
import { useSourceToolbar } from '../lib/toolbar'

export function CreateApiKeyPage() {
  const navigate = useNavigate()
  const [created, setCreated] = useState(false)
  const session = useQuery({
    queryKey: ['auth-session'],
    queryFn: fetchSession,
  })
  const user = session.data?.user

  function goBack() {
    void navigate({ to: '/' })
  }

  useEffect(() => {
    activate('apiKeys', 'command')
  }, [])

  useEffect(() => {
    if (session.isSuccess && !user) {
      void navigate({ to: '/login' })
    }
  }, [navigate, session.isSuccess, user])

  useSourceToolbar({
    title: created ? 'API key created' : 'Create an API key',
    backLabel: 'Sources',
    onBack: goBack,
  })

  usePaneFlags('apiKeys', {
    canEdit: Boolean(user) && !created,
    hasKey: created,
  })

  useFormPaneNavigation('apiKeys', 'create-api-key-form')

  usePaneActions('apiKeys', {
    parent: goBack,
    submitNow: {
      callback: () => submitForm('create-api-key-form'),
      enabled: Boolean(user) && !created,
      ignoreInputs: false,
    },
  })

  useEffect(() => {
    const timer = window.setTimeout(() => selectDefaultFormItem('create-api-key-form'), 0)
    const unbind = bindFormTabSync('create-api-key-form')
    return () => {
      window.clearTimeout(timer)
      unbind()
    }
  }, [created, user])

  if (!user) {
    return (
      <main
        id="api-keys-pane"
        className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-6 py-12"
      >
        <h1 className="text-3xl font-normal md:text-5xl">Create an API key</h1>
        <p className="mt-4 text-sm text-mute">Sign in to create an API key.</p>
      </main>
    )
  }

  return (
    <main
      id="api-keys-pane"
      className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-6 py-12"
    >
      <h1 className="text-3xl font-normal md:text-5xl">
        {created ? 'API key created' : 'Create an API key'}
      </h1>
      <CreateApiKeyForm onCreatedChange={setCreated} onCancel={goBack} />
    </main>
  )
}
