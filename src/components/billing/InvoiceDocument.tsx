import React from 'react'
import { Printer, X } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getRateConfig } from '../../utils/rateConfig'
import { getPaymentAccounts } from '../../utils/paymentAccounts'

interface InvoiceDocumentProps {
  primaryBooking: Booking
  rooms: Room[]
  venues: Venue[]
  statement: Statement
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}

const money = (n: number) => '₱' + n.toLocaleString()
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const fmtTime = (t?: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  const label = hh + ':' + String(m).padStart(2, '0') + period
  return h === 12 && m === 0 ? label.replace('pm', 'nn') : label
}

const PAY_METHODS = ['Cash', 'Gcash', 'Bank Transfer', 'Other']

// One labelled "fill-in-the-blank" line, like the paper form.
function Line({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <div className={'flex items-end gap-2 border-b border-slate-400/60 pb-0.5 ' + className}>
      <span className="text-[11px] font-bold whitespace-nowrap text-main">{label}:</span>
      <span className="flex-1 text-[13px] text-main min-h-[18px] break-words">{value || ''}</span>
    </div>
  )
}

// The printable "Guest Billing Statement" — mirrors the paper form staff fill
// in for walk-ins / Facebook calls, so the printed output looks familiar.
export function InvoiceDocument({ primaryBooking, rooms, venues, statement, onClose, onPrint, embedded = false }: InvoiceDocumentProps) {
  const rates = getRateConfig()
  const payAcct = getPaymentAccounts()
  const b = primaryBooking
  const isRoom = !!b.room_id
  const room = rooms.find(r => r.id === b.room_id)
  const venue = venues.find(v => v.id === b.venue_id)
  const roomType = isRoom ? (room?.name || '') : (venue?.name || '')
  const roomNo = isRoom ? String(room?.room_number ?? '') : ''

  const guestCount = 1 + (b.companions ? b.companions.length : 0)
  const hasCompanions = !!(b.companions && b.companions.length > 0)

  const pm = (statement.paymentMethod || '').toLowerCase()
  const isPaidBy = (m: string) => pm.includes(m.toLowerCase())

  return (
    <div className={'bg-card w-full max-w-3xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none ' + (embedded ? 'my-0 shadow-xl' : 'my-8')}>
      {/* Modal controls (hidden when printing) */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-800 text-white shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-white text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Billing statement</span>
          <span className="text-xs font-mono text-white/70">{statement.invoiceNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable body */}
      <div className="p-6 md:p-10 overflow-y-auto print:p-6 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static">
        {/* Brand header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-4">
          <div>
            <h1 className="font-display font-extrabold text-lg md:text-xl text-slate-800 uppercase tracking-tight">Daweez Pension House</h1>
            <p className="text-[11px] text-slate-600 mt-0.5">San Agustin Sur, Tandag City, Surigao del Sur</p>
            <p className="text-[11px] text-slate-600">Email Address: daweezpensionhouse@gmail.com</p>
            <p className="text-[11px] text-slate-600">Mobile No: 0910-7163830</p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="font-display font-bold text-[15px] text-slate-800 uppercase tracking-widest">Guest Billing Statement</h2>
            <div className="mt-2 text-[12px] text-slate-700 space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Bill / Invoice No.:</span>
                <span className="font-mono border-b border-slate-400/60">{statement.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Date Issued:</span>
                <span className="font-mono border-b border-slate-400/60">{statement.dateIssued}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-slate-700 my-2" />

        {/* Guest info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 py-3">
          <div className="space-y-2">
            <Line label="Guest's Name" value={b.guest_name} />
            <Line label="Address" value={b.guest_address} />
            <Line label="Email Address" value={b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''} />
            <Line label="Nationality" value={b.guest_nationality} />
          </div>
          <div className="space-y-2">
            <Line label="Birth Date" value={b.birthdate} />
            <Line label="Contact No." value={b.guest_phone} />
            <Line label="Plate No." value={b.vehicle_plate} />
            <div className="flex items-end gap-2 pb-0.5">
              <span className="text-[11px] font-bold whitespace-nowrap text-main">No. of Guests:</span>
              <span className="text-[13px]">Total <span className="font-mono">{guestCount}</span></span>
            </div>
          </div>
        </div>

        {/* Stay */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 py-2 border-t border-soft">
          <Line label="Room No." value={roomNo} />
          <Line label="Room Type" value={roomType} />
          <Line label="Check In Date &amp; Time" value={fmtDate(b.check_in)} />
          <Line label="Check Out Date &amp; Time" value={fmtDate(b.check_out)} />
          <Line label="Standard Check-in / Out" value={fmtTime(rates.standardCheckInTime) + ' / ' + fmtTime(rates.standardCheckOutTime)} />
        </div>

        {/* Companions */}
        <div className="py-3 border-t border-soft">
          <p className="text-[12px] font-bold uppercase tracking-wider text-main mb-1.5">Companion</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-400/60 text-left text-[10px] uppercase tracking-wider text-slate-600">
                <th className="py-1 px-1 font-bold w-1/3">Name</th>
                <th className="py-1 px-1 font-bold w-1/3">Nationality</th>
                <th className="py-1 px-1 font-bold w-1/3">Breakfast</th>
              </tr>
            </thead>
            <tbody>
              {hasCompanions ? (
                b.companions!.map((c, i) => (
                  <tr key={i} className="border-b border-slate-300/60">
                    <td className="py-1 px-1 text-[13px]">{c.name}</td>
                    <td className="py-1 px-1 text-[13px] capitalize">{c.nationality || ''}</td>
                    <td className="py-1 px-1 text-[13px]">{c.breakfast ? '✓' : ''}</td>
                  </tr>
                ))
              ) : (
                <>
                  <tr className="border-b border-slate-300/60"><td className="h-6" colSpan={3} /></tr>
                  <tr className="border-b border-slate-300/60"><td className="h-6" colSpan={3} /></tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Charges */}
        <div className="py-3 border-t border-soft">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-sand-100 border-y-2 border-slate-600 text-left text-[10px] uppercase tracking-wider text-slate-800">
                <th className="py-1.5 px-2 font-bold">Description</th>
                <th className="py-1.5 px-2 font-bold text-center w-16">Qty/Night</th>
                <th className="py-1.5 px-2 font-bold text-center w-16">Unit</th>
                <th className="py-1.5 px-2 font-bold text-right w-20">Price</th>
                <th className="py-1.5 px-2 font-bold text-center w-20">Discount/Promos</th>
                <th className="py-1.5 px-2 font-bold text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {statement.lineItems.map((it) => (
                <tr key={it.key} className="border-b border-slate-300/60">
                  <td className="py-1.5 px-2 text-[13px]">{it.description}</td>
                  <td className="py-1.5 px-2 text-center font-mono text-[13px]">{it.qty}</td>
                  <td className="py-1.5 px-2 text-center text-[11px] uppercase tracking-wide text-slate-600">{it.unit}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-[13px]">{it.price ? money(it.price) : '—'}</td>
                  <td className="py-1.5 px-2 text-center text-[11px] text-slate-600">{it.discount ? money(it.discount) : '—'}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-[13px]">{money(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment + totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-3 border-t-2 border-slate-700">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-main mb-1.5">Payment Method</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {PAY_METHODS.map(m => (
                <div key={m} className="flex items-center gap-1.5 text-[12.5px]">
                  <span className="inline-flex w-4 h-4 items-center justify-center border border-slate-400 text-[11px] font-bold">{isPaidBy(m) ? '✓' : ''}</span>
                  <span className={isPaidBy(m) ? 'font-semibold' : ''}>{m}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-dashed border-slate-400 space-y-0.5 text-[11px] text-slate-600">
              <p className="text-[10px] font-bold uppercase tracking-wider text-main mb-1">Account Details</p>
              <p>{payAcct.bankName} Name: <strong className="text-main">{payAcct.bankAccountName}</strong></p>
              <p>{payAcct.bankName} Account No: <strong className="font-mono text-main">{payAcct.bankAccountNumber}</strong></p>
              <p>GCash Name: <strong className="text-main">{payAcct.gcashName}</strong></p>
              <p>GCash No: <strong className="font-mono text-main">{payAcct.gcashNumber}</strong></p>
            </div>
          </div>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-slate-600">Sub-Total</span><span className="font-mono">{money(statement.subTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Less: Downpayment/Deposit</span><span className="font-mono">−{money(statement.downpaymentPaid)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Partial Payment</span><span className="font-mono">−{money(statement.partialPayment)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Other</span><span className="font-mono">−{money(statement.other)}</span></div>
            <div className="flex justify-between border-t border-slate-400 pt-1.5">
              <span className="font-bold uppercase tracking-wider text-main">Amount Due</span>
              <span className="font-display text-[22px] font-extrabold text-slate-900">{money(statement.amountDue)}</span>
            </div>
          </div>
        </div>

        {/* Pension Policies */}
        <div className="mt-5 border-t border-dashed border-slate-400 pt-3 space-y-1 text-[9.5px] text-slate-600 leading-snug">
          <p className="text-[10px] font-bold uppercase tracking-wider text-main">Pension Policies</p>
          <p>Early check-in &amp; late checkout — ₱{rates.lateEarlyRatePesos}/hour (after {rates.lateEarlyCapHours} hours, 1 night). Standard check-in {fmtTime(rates.standardCheckInTime)} / check-out {fmtTime(rates.standardCheckOutTime)}.</p>
          <p>No smoking inside rooms. Key card deposit — ₱500. Security deposit — ₱{rates.securityDeposit}. The guest is responsible for loss or damage.</p>
        </div>

        {/* Prepared by + Guest Signature */}
        <div className="grid grid-cols-2 gap-6 mt-5 pt-4 border-t border-dashed border-slate-400">
          <div className="flex items-end gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Prepared by:</span>
            <div className="flex-1 border-b border-slate-400 h-6" />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Guest Signature:</span>
            <div className="flex-1 border-b border-slate-400 h-6" />
          </div>
        </div>
        <p className="mt-2 text-[9.5px] text-slate-500 italic">By signing this form, I understand and agree to the Pension Policies.</p>

        <p className="mt-3 text-[10px] text-slate-500 uppercase tracking-widest">Unit: Night / Hour / Person</p>
      </div>
    </div>
  )
}
