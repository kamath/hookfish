import {
  WorkbenchPage,
  validateWorkbenchSearch,
} from '@hookfish/app'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

export const Route = createFileRoute('/apis/$apiId/$pane/{-$operationId}')({
  ssr: false,
  validateSearch: validateWorkbenchSearch,
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const onSearchChange = useCallback(
    (search: { q?: string }) => {
      void navigate({ search, replace: true, resetScroll: false })
    },
    [navigate],
  )

  return (
    <WorkbenchPage
      params={Route.useParams()}
      search={Route.useSearch()}
      onSearchChange={onSearchChange}
    />
  )
}
