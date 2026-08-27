import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'
import { configureApiBaseUrl } from './lib/api'
import { createClientRouter } from './router'
import './styles.css'

export type HookfishClientProps = {
  apiBaseUrl: string
}

export function HookfishClient({ apiBaseUrl }: HookfishClientProps) {
  configureApiBaseUrl(apiBaseUrl)
  const [router] = useState(createClientRouter)

  return <RouterProvider router={router} />
}
