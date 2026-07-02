import React from 'react'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="w-full">{children}</main>
    </div>
  )
}
