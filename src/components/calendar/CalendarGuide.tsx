import React from 'react'
import { Building2, Check, Coffee, LogIn, LogOut } from 'lucide-react'

// The key to the calendar: **every sign on it, and what it means, in one place** (Sebastian,
// 2026-10-08: *"move all of the instructions there so that all the calendar is showing is
// just the visuals and not so much text"*). The calendar says things with colours, edges and
// corners; the words for them live here, behind the `?` on the calendar's top line, so the
// grid itself carries none. It took the place of the four swatches that sat on the Today line.
//
// A sign added to the calendar is added here in the same change.
export function CalendarGuide() {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative ml-1.5">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        title="What the signs on the calendar mean" aria-label="Guide to the calendar"
        className={'h-8 w-8 rounded-full border border-gold-400 font-display text-[15px] font-bold transition-colors duration-150 active:scale-95 cursor-pointer ' +
          (open ? 'bg-gold-400 text-ink-900' : 'bg-card text-brand-text hover:bg-gold-100')}>
        ?
      </button>
      {open && (<>
        {/* A tap anywhere else puts it away. */}
        <button type="button" aria-label="Close the guide" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <div className="absolute right-0 top-full z-50 mt-2 w-[290px] max-w-[calc(100vw-2rem)] rounded-lg border border-gold-400 bg-card px-3.5 pb-3.5 pt-3 text-left text-[13px] text-main animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-display text-[14px] font-bold">Guide</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">Close</button>
          </div>

          <Section title="On the booking">
            <Row sign={<Pill className="bg-card border-paper-400" />}>Booked, not here yet</Row>
            <Row sign={<Pill className="bg-card border-paper-400 border-l-[5px] border-l-emerald-700" />}>Arrives today</Row>
            <Row sign={<Pill className="bg-emerald-50 border-emerald-600" />}>In the room</Row>
            <Row sign={<Pill className="bg-emerald-50 border-emerald-600 border-r-[5px] border-r-ink-900" />}>Leaves today</Row>
            <Row sign={<Pill className="bg-ink-100 border-ink-200 text-white"><span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-ink-600"><Check className="w-2 h-2" strokeWidth={3} /></span></Pill>}>Has left</Row>
            <Row sign={<Pill className="bg-paper-200/60 border-paper-300" />}>Blocked</Row>
            <Row sign={<Building2 className="w-4 h-4" />}>Agency reservation</Row>
            <Row sign={<span className="font-display text-[13px] font-bold text-blue-700">AB</span>}>Blue initials: no deposit</Row>
            <Row sign={<span className="font-display font-bold"><span className="text-danger-600">₱</span> <span className="text-emerald-700">₱</span></span>}>Red to pay, green paid</Row>
          </Section>

          <Section title="On the room">
            <Row sign={<span className="h-5 w-[5px] rounded-sm bg-emerald-600" />}>A guest is in this room</Row>
            <Row sign={<Coffee className="w-5 h-5 animate-hop" />}>Tap to ask this room about breakfast</Row>
          </Section>

          <Section title="Under the date">
            <Row sign={<span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-emerald-700"><LogIn className="w-3 h-3 -scale-x-100" />2</span>}>How many will arrive that day</Row>
            <Row sign={<span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-ink-900"><LogOut className="w-3 h-3" />6</span>}>How many will leave that day</Row>
          </Section>
        </div>
      </>)}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </>
  )
}

function Row({ sign, children }: { sign: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex w-8 shrink-0 items-center justify-center">{sign}</span>
      <span>{children}</span>
    </li>
  )
}

/** A booking pill, small. */
function Pill({ className, children }: { className: string; children?: React.ReactNode }) {
  return <span className={'relative flex h-5 w-[30px] items-center justify-center overflow-hidden rounded border ' + className}>{children}</span>
}
