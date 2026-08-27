import { HookfishClient } from '@hookfish/client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_client')({
  ssr: false,
  component: ClientMount,
})

function ClientMount() {
  return <HookfishClient apiBaseUrl="/api" />
}
