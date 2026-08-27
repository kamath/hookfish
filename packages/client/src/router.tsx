import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserHistory, createRouter } from '@tanstack/react-router'
import { Provider as JotaiProvider } from 'jotai'
import { store } from './lib/chrome'
import { apiClientRoute } from './routes/apis.$apiId.$pane.{-$operationId}'
import { indexRoute } from './routes/index'
import { rootRoute } from './routes/root'

const routeTree = rootRoute.addChildren([indexRoute, apiClientRoute])

export function createClientRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
      },
    },
  })

  return createRouter({
    routeTree,
    history: createBrowserHistory(),
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </JotaiProvider>
    ),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createClientRouter>
  }
}
