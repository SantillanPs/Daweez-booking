import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/MainLayout'
import { GuestPortal } from './components/GuestPortal'
import { AdminPortal } from './components/AdminPortal'
import { ChatbotWidget } from './components/ChatbotWidget'

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
  // Simple clean panel routing state
  const [currentView, setCurrentView] = useState<'guest' | 'admin'>('guest')

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        {currentView === 'guest' ? (
          <>
            <GuestPortal onNavigateToAdmin={() => setCurrentView('admin')} />
            <ChatbotWidget />
          </>
        ) : (
          <AdminPortal onNavigateToGuest={() => setCurrentView('guest')} />
        )}
      </MainLayout>
    </QueryClientProvider>
  )
}
