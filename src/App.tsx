import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/MainLayout'
import { AdminPortal } from './components/AdminPortal'

// 1. Initialise the global TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent distracting refetches on focus
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <AdminPortal />
      </MainLayout>
    </QueryClientProvider>
  )
}

