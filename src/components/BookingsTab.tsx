import React from 'react'
import { Construction } from 'lucide-react'

export function BookingsTab() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[60vh] text-center font-sans">
      <div className="w-16 h-16 flex items-center justify-center bg-[#FDFBF7] border border-[#E5D5C0] text-[#B89251] rounded-2xl mb-4 shadow-sm animate-pulse">
        <Construction className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-slate-850">Bookings Module</h2>
      <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed font-medium">
        This section is currently under active development. High-fidelity reservations management tools will be arriving in a future release.
      </p>
    </div>
  )
}
