import React from 'react'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-page text-main">
      <main className="w-full">{children}</main>
    </div>
  )
}
