import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/MainLayout'
import { AdminPortal } from './components/AdminPortal'
import { LoginPortal } from './components/LoginPortal'

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('daweez_pms_auth') === 'true'
  })

  const handleLogout = () => {
    localStorage.removeItem('daweez_pms_auth')
    setIsAuthenticated(false)
  }

  return (
    <QueryClientProvider client={queryClient}>
      {isAuthenticated ? (
        <MainLayout>
          <AdminPortal onLogout={handleLogout} />
        </MainLayout>
      ) : (
        <LoginPortal onLoginSuccess={() => setIsAuthenticated(true)} />
      )}
    </QueryClientProvider>
  )
}


