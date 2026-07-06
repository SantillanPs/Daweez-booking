import React from 'react'
import { Construction } from 'lucide-react'

export function GuestsTab() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[60vh] text-center font-sans">
      <div className="w-16 h-16 flex items-center justify-center bg-[#FDFBF7] border border-[#E5D5C0] text-[#B89251] rounded-2xl mb-4 shadow-sm animate-pulse">
        <Construction className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-slate-850">Guests Registry</h2>
      <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed font-medium">
        This section is currently under active development. The guest records and loyalty analytics console will be available soon.
      </p>
    </div>
  )
}
