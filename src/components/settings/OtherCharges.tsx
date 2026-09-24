import React from 'react'
import { RateConfig, PaymentAccounts } from '../../types/booking'
import { NumInput } from '../NumInput'

interface OtherChargesProps {
  rates: RateConfig
  onRate: (patch: Partial<RateConfig>) => void
  pay: PaymentAccounts
  onPay: (patch: Partial<PaymentAccounts>) => void
}

function Num({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-page border border-soft rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <span className="flex items-center gap-1">
        {suffix && <span className="text-[11px] text-muted font-bold">{suffix}</span>}
        <NumInput value={value} onChange={onChange}
          className="w-24 bg-card border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
      </span>
    </label>
  )
}

function TimeBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-page border border-soft rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <input type="time" value={value} onChange={e => onChange(e.target.value)}
        className="w-24 bg-card border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
    </label>
  )
}

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-soft rounded-xl overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-3.5 border-b border-soft">
        <h3 className="text-sm font-semibold text-main">{title}</h3>
        <p className="text-xs text-muted mt-1">{note}</p>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function PayLine({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-muted mb-1">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
    </label>
  )
}

/**
 * Everything that is not a room's own price: the venues, the arrival and departure
 * rules, the things a guest can add, where the guest sends money, and the two figures
 * that exist only for the Earnings Report.
 *
 * One card per KIND of money, in the order the desk meets it (the owner's design,
 * 2026-09). Every figure is unchanged from before — only where it sits has moved.
 */
export function OtherCharges({ rates, onRate, pay, onPay }: OtherChargesProps) {
  return (
    <div className="space-y-4">
      <Card title="Venues" note="Vacation House, Gazebo and Garden Area — the figures their bookings use.">
        <Num label="Vacation House, per hour" value={rates.venueHourlyRate} onChange={v => onRate({ venueHourlyRate: v })} suffix="₱" />
        <Num label="Gazebo / Garden block, hours" value={rates.venueDayBlockHours} onChange={v => onRate({ venueDayBlockHours: v })} suffix="hrs" />
        <Num label="Gazebo / Garden, per block (0 = the venue's own price)" value={rates.dayBlockRate} onChange={v => onRate({ dayBlockRate: v })} suffix="₱" />
      </Card>

      <Card title="Arrival & departure" note="The rules printed on the statement: standard times, and what an early arrival or a late departure costs.">
        <TimeBox label="Standard check-in" value={rates.standardCheckInTime} onChange={v => onRate({ standardCheckInTime: v })} />
        <TimeBox label="Standard check-out" value={rates.standardCheckOutTime} onChange={v => onRate({ standardCheckOutTime: v })} />
        <Num label="Early / late, per hour (rooms)" value={rates.lateEarlyRatePesos} onChange={v => onRate({ lateEarlyRatePesos: v })} suffix="₱" />
        <Num label="After this many hours, a whole night" value={rates.lateEarlyCapHours} onChange={v => onRate({ lateEarlyCapHours: v })} suffix="hrs" />
        <Num label="Security deposit" value={rates.securityDeposit} onChange={v => onRate({ securityDeposit: v })} suffix="₱" />
      </Card>

      <Card title="Things guests can add" note="Per night for the room extras, per piece for the event ones.">
        <Num label="Extra foam · per night" value={rates.foamRate} onChange={v => onRate({ foamRate: v })} suffix="₱" />
        <Num label="Extra pillow · per night" value={rates.pillowRate} onChange={v => onRate({ pillowRate: v })} suffix="₱" />
        <Num label="Extra blanket · per night" value={rates.blanketRate} onChange={v => onRate({ blanketRate: v })} suffix="₱" />
        <Num label="Extra towel · per night" value={rates.towelRate} onChange={v => onRate({ towelRate: v })} suffix="₱" />
        <Num label="Mineral water" value={rates.mineralWaterRate} onChange={v => onRate({ mineralWaterRate: v })} suffix="₱" />
        <Num label="Big table (event)" value={rates.bigTableRate} onChange={v => onRate({ bigTableRate: v })} suffix="₱" />
        <Num label="Small table (event)" value={rates.smallTableRate} onChange={v => onRate({ smallTableRate: v })} suffix="₱" />
        <Num label="Chair (event)" value={rates.chairRate} onChange={v => onRate({ chairRate: v })} suffix="₱" />
        <Num label="Tent (event)" value={rates.tentRate} onChange={v => onRate({ tentRate: v })} suffix="₱" />
      </Card>

      <div className="bg-card border border-soft rounded-xl overflow-hidden font-sans shadow-sm">
        <div className="px-5 py-3.5 border-b border-soft">
          <h3 className="text-sm font-semibold text-main">Where guests pay</h3>
          <p className="text-xs text-muted mt-1">Printed on the guest's statement and shown on the booking portal. Full values, so nothing is cut off.</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted tracking-widest uppercase">GCash</p>
            <PayLine label="Account name" value={pay.gcashName} onChange={v => onPay({ gcashName: v })} placeholder="Narlina D." />
            <PayLine label="Number" value={pay.gcashNumber} onChange={v => onPay({ gcashNumber: v })} placeholder="0910 000 0000" />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted tracking-widest uppercase">Bank transfer</p>
            <PayLine label="Bank" value={pay.bankName} onChange={v => onPay({ bankName: v })} placeholder="BPI" />
            <PayLine label="Account name" value={pay.bankAccountName} onChange={v => onPay({ bankAccountName: v })} placeholder="Daweez Pension House" />
            <PayLine label="Account number" value={pay.bankAccountNumber} onChange={v => onPay({ bankAccountNumber: v })} placeholder="5636 0000 00" />
          </div>
        </div>
      </div>

      {/* Report-only, kept apart on purpose: these look like prices and are not. */}
      <div className="bg-card border border-soft rounded-xl overflow-hidden font-sans shadow-sm">
        <div className="px-5 py-3.5 border-b border-soft">
          <h3 className="text-sm font-semibold text-main">For the Earnings Report only — these never appear on a bill</h3>
          <p className="text-xs text-muted mt-1">A flat amount added to each group in the Earnings Report. No guest is ever charged these.</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Num label="Extras: Rooms + Vacation House" value={rates.accommodationExtras} onChange={v => onRate({ accommodationExtras: v })} suffix="₱" />
          <Num label="Extras: Garden + Gazebo" value={rates.venueExtras} onChange={v => onRate({ venueExtras: v })} suffix="₱" />
        </div>
      </div>
    </div>
  )
}
