import {
  WorkbenchPage,
  validateWorkbenchSearch,
} from '@hookfish/app'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/apis/$apiId/$pane/{-$operationId}')({
  ssr: false,
  validateSearch: validateWorkbenchSearch,
  component: RouteComponent,
})

function RouteComponent() {
  return <WorkbenchPage params={Route.useParams()} search={Route.useSearch()} />
}
