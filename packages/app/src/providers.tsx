import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { Provider as JotaiProvider } from 'jotai'
import { type ReactNode } from 'react'
import { store } from './lib/chrome'

export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  return (
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </JotaiProvider>
  )
}
