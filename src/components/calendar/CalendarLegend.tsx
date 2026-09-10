import React from 'react'

// Vertical color-key rail that sits on the LEFT of the calendar, so the color
// legend stops stealing horizontal "head space" from the top of the page.
export function CalendarLegend() {
  return (
    <aside className="hidden md:flex w-[112px] shrink-0 h-full flex-col gap-3 overflow-y-auto no-scrollbar bg-card border border-soft rounded-xl p-3 text-[10px] text-muted">
      <div>
        <p className="font-bold uppercase tracking-wider text-[9px] text-muted/80 mb-1.5">Booked from</p>
        <div className="flex flex-col gap-1.5">
          <LegendSwatch className="bg-emerald-100 border-emerald-200" label="Airbnb" />
          <LegendSwatch className="bg-sky-100 border-sky-200" label="Booking.com" />
          <LegendSwatch className="bg-indigo-100 border-indigo-200" label="Facebook" />
          <LegendSwatch className="bg-orange-100 border-orange-200" label="Google Maps" />
          <LegendSwatch className="bg-violet-100 border-violet-200" label="Website" />
          <LegendSwatch className="bg-gold-100 border-gold-200" label="Walk-in" />
          <LegendSwatch className="bg-gold-100 border-gold-200" label="Event venue" />
          <LegendSwatch className="bg-amber-50 border-amber-200 border-dashed" label="On hold" />
          <LegendSwatch className="bg-paper-200 border-paper-300 line-through" label="Blocked" />
        </div>
      </div>

      <div>
        <p className="font-bold uppercase tracking-wider text-[9px] text-muted/80 mb-1.5">Payment</p>
        <div className="flex flex-col gap-1.5">
          <DotSwatch className="bg-danger-500" label="owes" />
          <DotSwatch className="bg-amber-400" label="deposit only" />
          <DotSwatch className="bg-emerald-500" label="paid" />
        </div>
      </div>

      <div>
        <p className="font-bold uppercase tracking-wider text-[9px] text-muted/80 mb-1.5">Guest</p>
        <span className="flex items-center gap-2">
          <span className="text-[8px] font-bold uppercase text-rose-600 bg-rose-50 border border-rose-100 rounded-sm px-1 py-px">out</span>
          guest leaves
        </span>
      </div>

      <p className="text-gold-700 font-semibold mt-auto pt-2 border-t border-soft/70">Tip: click an empty day to book</p>
    </aside>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={'w-3.5 h-3.5 rounded border shrink-0 ' + className} />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  )
}

function DotSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={'w-2 h-2 rounded-full shrink-0 ' + className} />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  )
}
