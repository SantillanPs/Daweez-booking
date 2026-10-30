import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { watchForUpdates } from './utils/appUpdate'

// 1. Initialise the global TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent distracting refetches on focus
      retry: 1,
    },
  },
})

// A screen left open reloads itself into an update, at a moment nobody loses anything.
watchForUpdates(queryClient)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
