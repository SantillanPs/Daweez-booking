import React from 'react'

// Explains the calendar colors and payment dots in plain words so staff
// never have to guess what a block means.
export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[10px] text-muted flex-shrink-0 px-0.5">
      <span className="font-bold uppercase tracking-wider text-[9px] text-muted/80">Booked from</span>
      <LegendSwatch className="bg-emerald-100 border-emerald-200" label="Airbnb" />
      <LegendSwatch className="bg-sky-100 border-sky-200" label="Booking.com" />
      <LegendSwatch className="bg-indigo-100 border-indigo-200" label="Facebook" />
      <LegendSwatch className="bg-orange-100 border-orange-200" label="Google Maps" />
      <LegendSwatch className="bg-violet-100 border-violet-200" label="Website" />
      <LegendSwatch className="bg-sea-100 border-sea-200" label="Walk-in" />
      <LegendSwatch className="bg-sun-100 border-sun-200" label="Event venue" />
      <LegendSwatch className="bg-amber-50 border-amber-200 border-dashed" label="On hold" />
      <LegendSwatch className="bg-sand-200 border-sand-300 line-through" label="Blocked" />

      <span className="font-bold uppercase tracking-wider text-[9px] text-muted/80 ml-1">Payment</span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-coral-500" /> owes
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400" /> deposit only
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500" /> paid
      </span>

      <span className="flex items-center gap-1.5">
        <span className="text-[8px] font-bold uppercase text-rose-600 bg-rose-50 border border-rose-100 rounded-sm px-1 py-px">out</span> guest leaves
      </span>

      <span className="text-sea-700 font-semibold ml-auto">Tip: click an empty day to start a booking</span>
    </div>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={'w-3.5 h-3.5 rounded border ' + className} />
      {label}
    </span>
  )
}
