import React from 'react'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden">
      {/* Soft light decorative gradient overlays */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#B89251]/5 to-transparent pointer-events-none z-0" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#B89251]/5 blur-3xl pointer-events-none z-0" />


      {/* Main Content wrapper */}
      <main className="relative z-10 w-full">
        {children}
      </main>
    </div>
  )
}
export default MainLayout;

