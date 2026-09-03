import { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { useCallback } from 'react'
import { App, AppErrorPage, AppNotFound } from './app'
import { HomePage } from './pages/home'
import { LoginPage } from './pages/login'
import {
  WorkbenchPage,
  validateWorkbenchSearch,
} from './pages/workbench'
import { AppProviders } from './providers'

export type AppRouterOptions = {
  apiBaseUrl?: string
  basepath?: string
}

export function createAppRouter(options: AppRouterOptions = {}) {
  const rootRoute = createRootRoute({
    component: () => (
      <App apiBaseUrl={options.apiBaseUrl}>
        <Outlet />
      </App>
    ),
    notFoundComponent: AppNotFound,
    errorComponent: AppErrorPage,
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
  })

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: LoginPage,
  })

  const workbenchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/apis/$apiId/$pane/{-$operationId}',
    validateSearch: validateWorkbenchSearch,
    component: WorkbenchRoute,
  })

  function WorkbenchRoute() {
    const navigate = workbenchRoute.useNavigate()
    const onSearchChange = useCallback(
      (search: { q?: string }) => {
        void navigate({ search, replace: true, resetScroll: false })
      },
      [navigate],
    )

    return (
      <WorkbenchPage
        params={workbenchRoute.useParams()}
        search={workbenchRoute.useSearch()}
        onSearchChange={onSearchChange}
      />
    )
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
      },
    },
  })

  return createRouter({
    routeTree: rootRoute.addChildren({ indexRoute, loginRoute, workbenchRoute }),
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <AppProviders queryClient={queryClient}>{children}</AppProviders>
    ),
    ...(options.basepath ? { basepath: options.basepath } : {}),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

export function mountApp(element: HTMLElement, options: AppRouterOptions = {}) {
  const router = createAppRouter(options)
  const root = createRoot(element)
  root.render(<RouterProvider router={router} />)

  return () => {
    root.unmount()
  }
}
