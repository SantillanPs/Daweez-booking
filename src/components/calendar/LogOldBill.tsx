import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Coffee, Plus, X } from 'lucide-react'
import { Booking, BillCharge, Companion, EventAddons, PaymentRecord } from '../../types/booking'
import { buildStatement, StatementLineItem } from '../../utils/statement'
import { dateToString, generateUUID } from '../../utils/helpers'
import { breakfastSellable, roomBreakfastPrice } from '../../utils/breakfast'
import { venueTypes } from '../../utils/venueTypes'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { lastReceptionist, rememberReceptionist, staffNamesOf } from '../../utils/receptionists'
import { StatementShell, BrandHeader, SectionName } from '../billing/StatementShell'
import { StatementChargesTable } from '../billing/StatementChargesTable'
import { ADD, AddCharge, WritePayment } from '../billing/BillDesk'
import { want } from '../billing/want'
import { PayRow } from '../billing/FixPayment'
import { randomUUID } from '../../utils/helpers'
import { NationalityInput } from '../NationalityInput'
import { CountPeso } from '../CountPeso'
import { PriceBox } from '../PriceBox'
import { useDashboardData } from '../DashboardContext'
import { showToast } from '../../utils/toast'
import { Circled, LogOldBookingModal, Sel } from './LogOldBookingModal'

const HOURS = [3, 6, 12, 22] as const
const money = (n: number) => '₱' + Math.round(n).toLocaleString()
const nextDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return dateToString(new Date(y, m - 1, d + 1)) }
const fmtDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
const shortDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

interface Paid { id: string; amount: number; method: string; reference: string; date: string; purpose: string }

/**
 * **Log old booking on the billing statement** (Sebastian, 2026-10-23, the log-on-the-bill mock:
 * the staff like to work on the guest billing paper). A blank statement with the calendar's pick
 * on it: the paper's No. and date where the Bill no. sits, the guest on blank lines, the charges
 * table priced by the real statement builder, payments written on the bill's own blank line with
 * the day they were paid, and the receptionist circled on "Prepared by". **Nothing is saved
 * until Log booking**, so a paper left halfway leaves nothing behind. The paper form stays as the
 * other choice in Settings → Front desk.
 */
export function LogOldBill({ rooms, venues, bookings, createManualBooking, onClose, initialSelections, shortStay, shortHalf }: React.ComponentProps<typeof LogOldBookingModal>) {
  const { updateRoomBreakfastPrice } = useDashboardData()
  // The room whose breakfast is being priced in its blank.
  const [pricing, setPricing] = useState<string | null>(null)
  const [regNo, setRegNo] = useState('')
  const [regOn, setRegOn] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [nationality, setNationality] = useState('')
  const [address, setAddress] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [more, setMore] = useState(false)
  const [hours, setHours] = useState<number>(3)
  const [breakfast, setBreakfast] = useState<string[]>([])
  // Each room's add-ons, by its id: a venue's kind and the charges written on the bill.
  const [addons, setAddons] = useState<Record<string, EventAddons>>({})
  // A charge just taken off, which Undo puts back as it was.
  const [removed, setRemoved] = useState<{ label: string; breakfast: string[]; addons: Record<string, EventAddons> } | null>(null)
  const [paid, setPaid] = useState<Paid[]>([])
  const [writing, setWriting] = useState(false)
  const [preparedBy, setPreparedBy] = useState(lastReceptionist)
  const [staffNames, setStaffNames] = useState(() => staffNamesOf(bookings))
  const [typingStaff, setTypingStaff] = useState(false)
  const [error, setError] = useState('')
  const [logged, setLogged] = useState(false)
  const nameBox = useRef<HTMLInputElement>(null)
  // The payment and charge boxes float inside the bill's own sheet.
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null)

  const entries = Object.entries(initialSelections || {})
  // A short stay is one room for one day: the room and the day the desk picked.
  const isShort = !!shortStay && entries[0]?.[1].type === 'room'
  const list: [string, Sel][] = isShort ? [[entries[0][0], { ...entries[0][1], checkOut: nextDay(entries[0][1].checkIn) }]] : entries
  const first = list[0]?.[1]

  // The rooms as bookings that do not exist yet, so the bill is the real bill: the same
  // builder, the same pricing rule, the same rows the printed statement has.
  const draftOf = (id: string, s: Sel): Booking => {
    const ea = addons[id] || {}
    return {
      security_deposit: 0, created_at: '', expires_at: null,
      id: 'draft-' + id, room_id: s.type === 'room' ? id : undefined, venue_id: s.type === 'venue' ? id : undefined,
      guest_name: guestName, guest_email: '', guest_phone: '', check_in: s.checkIn, check_out: s.checkOut,
      source: 'manual', status: 'confirmed', payment_records: [], downpayment_paid: 0, balance_due: 0,
      breakfast_included: breakfast.includes(id), stay_hours: isShort ? hours : undefined,
      event_addons: Object.keys(ea).length > 0 ? ea : undefined,
    } as Booking
  }
  const drafts = list.map(([id, s]) => draftOf(id, s))
  const statement = drafts.length > 0
    ? buildStatement({ primaryBooking: drafts[0], relatedBookings: drafts, rooms, venues, bookingsList: bookings })
    : null
  const subTotal = statement?.subTotal ?? 0
  const paidTotal = paid.reduce((a, p) => a + p.amount, 0)
  const due = Math.max(0, subTotal - paidTotal)
  const paidUp = due === 0 && paid.length > 0

  const unitOf = (key: string) => list.find(([id]) => key.startsWith('draft-' + id + '-'))?.[0]
  const removeLine = (line: StatementLineItem) => {
    const id = unitOf(line.key)
    if (!id || !line.remove) return
    setRemoved({ label: line.description, breakfast, addons })
    // The rooms' breakfasts are one line, so its × takes them all off (Undo puts them back).
    if ('breakfast_included' in line.remove) setBreakfast([])
    if (line.remove.event_addons) setAddons(a => ({ ...a, [id]: line.remove!.event_addons! }))
  }
  // A charge goes on the bill's first room, as on a booking of several rooms.
  const addCharge = (name: string, amount: number) => {
    const id = list[0]?.[0]
    if (!id) return
    const c: BillCharge = { id: randomUUID(), name, amount, date: first!.checkIn }
    setAddons(a => ({ ...a, [id]: { ...a[id], charges: [...(a[id]?.charges || []), c] } }))
    setRemoved(null)
  }
  const setKind = (id: string, key: string) => setAddons(a => {
    const rest = { ...a[id] }
    delete rest.venue_type
    return { ...a, [id]: key ? { ...rest, venue_type: key } : rest }
  })

  const reset = () => {
    // The receptionist on duty stays: the next paper is usually from the same shift.
    setRegNo(''); setRegOn(''); setGuestName(''); setGuestPhone(''); setNationality(''); setAddress('')
    setCompanions([]); setMore(false); setHours(3); setBreakfast([]); setAddons({}); setRemoved(null)
    setPaid([]); setWriting(false); setError(''); setLogged(false)
  }

  const handleSave = async () => {
    if (!guestName.trim()) { want(nameBox.current); return }
    if (list.length === 0) { setError('Pick the room and the dates on the calendar first.'); return }
    // The seal shows at once and the rows are saved behind it; a failure takes it back.
    setError(''); setLogged(true)
    if (preparedBy.trim()) rememberReceptionist(preparedBy)
    try {
      const n = list.length
      const own = drafts.map(d => buildStatement({ primaryBooking: d, relatedBookings: [d], rooms, venues, bookingsList: bookings }).subTotal)
      // Each payment is split across the rooms by what each still owes, and stored on EVERY room
      // it paid for with that room's slice as `share` (the owner's ruling, 2026-09-30). Split by
      // what is left, not by each room's whole bill: rounding each payment on its own put a peso
      // on the wrong room, so a bill paid in full left one room "₱1 owed" (2026-10-23).
      const sofar = own.map(() => 0)
      const shares = paid.map(p => {
        const rest = own.map((o, i) => Math.max(0, o - sofar[i]))
        const restTotal = rest.reduce((a, b) => a + b, 0)
        const pay = Math.min(p.amount, restTotal)
        const row = rest.map(r => (restTotal > 0 ? Math.floor(pay * r / restTotal) : 0))
        let left = pay - row.reduce((a, b) => a + b, 0)
        for (let i = 0; i < n && left > 0; i++) { const add = Math.min(rest[i] - row[i], left); row[i] += add; left -= add }
        // More than the bill: the extra sits on the first room.
        row[0] += p.amount - pay
        row.forEach((v, i) => { sofar[i] += v })
        return row
      })
      const groupId = n > 1 ? 'grp-' + generateUUID() : undefined
      const cleaned = companions.filter(c => c.name.trim())
      // A stay that is already over is logged as over: checked in and out at the standard times.
      const today = dateToString(new Date())
      const at = (iso: string, h: number) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString() }
      for (let i = 0; i < n; i++) {
        const [id, s] = list[i]
        const down = shares.reduce((a, row) => a + row[i], 0)
        const bal = Math.max(0, own[i] - down)
        const records: PaymentRecord[] = paid.map((p, j) => ({
          id: p.id, amount: p.amount, method: p.method, paid_at: new Date(p.date + 'T12:00:00').toISOString(),
          purpose: p.purpose, ...(p.reference ? { reference: p.reference } : {}),
          ...(preparedBy.trim() ? { prepared_by: preparedBy.trim() } : {}),
          ...(n > 1 ? { share: shares[j][i] } : {}),
        }))
        const ea = addons[id]
        await createManualBooking({
          roomId: s.type === 'room' ? id : undefined,
          venueId: s.type === 'venue' ? id : undefined,
          groupId,
          guestName: guestName.trim(),
          guestEmail: 'admin@daweez-booking.vercel.app',
          guestPhone: guestPhone.trim() || 'None',
          guestAddress: address.trim() || undefined,
          guestNationality: nationality.trim() || undefined,
          companions: cleaned.length > 0 ? cleaned : undefined,
          checkIn: s.checkIn, checkOut: s.checkOut, source: 'manual', status: 'confirmed',
          referenceNumber: regNo.trim() || undefined,
          registeredOn: regOn || undefined,
          breakfastIncluded: breakfast.includes(id),
          eventAddons: ea && Object.keys(ea).length > 0 ? ea : undefined,
          stayHours: isShort ? hours : undefined,
          stayHalf: isShort ? shortHalf : undefined,
          paymentMethod: paid.length > 0 ? paid[paid.length - 1].method : undefined,
          downpaymentPaid: down,
          balanceDue: bal,
          paymentStatus: bal <= 0 ? 'paid' : down > 0 ? 'downpayment' : 'unpaid',
          paymentRecords: records.length > 0 ? records : undefined,
          preparedBy: preparedBy.trim() || undefined,
          ...((isShort ? s.checkIn < today : s.checkOut < today) ? {
            actualCheckIn: at(s.checkIn, 14),
            actualCheckOut: isShort ? at(s.checkIn, 14 + hours) : at(s.checkOut, 12),
          } : {}),
        })
      }
    } catch (err) {
      setLogged(false)
      setError(err instanceof Error ? err.message : 'Could not save the booking. Please try again.')
    }
  }

  const unitName = (id: string, s: Sel) => s.type === 'room'
    ? ['Room ' + (rooms.find(r => r.id === id)?.room_number ?? ''), rooms.find(r => r.id === id)?.name].filter(Boolean).join(' · ')
    : venues.find(v => v.id === id)?.name || id

  if (logged) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
        <div className="w-full max-w-md bg-card rounded-xl shadow-softLg p-8 grid justify-items-center gap-3 text-center bw-arrive">
          <span className="w-[72px] h-[72px] rounded-full bg-emerald-50 grid place-items-center bk-pop">
            <Check className="w-9 h-9 text-emerald-600" strokeWidth={3} />
          </span>
          <h3 className="font-display font-bold text-[20px] text-main">Logged</h3>
          <p className="text-[14px] text-muted">
            {guestName.trim()} · {list.map(([id, s]) => unitName(id, s).split(' · ')[0]).join(', ')}{isShort ? ' · ' + hours + ' hours' : ''} · {paidTotal > 0 ? money(paidTotal) + ' paid' : 'nothing paid'}
          </p>
          <button type="button" onClick={reset}
            className="w-full max-w-xs min-h-[54px] mt-2 rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[16px] font-bold cursor-pointer active:scale-[0.98] transition-[background-color,transform] bw-shine">
            Log another
          </button>
          <button type="button" onClick={onClose} className="min-h-11 px-4 text-[14px] font-bold text-muted hover:text-main cursor-pointer">Done</button>
        </div>
      </div>,
      document.body,
    )
  }

  // The page's three kinds of text, as on the bill: a grey label, black information, a figure.
  const label = 'text-[10px] text-muted'
  const figure = 'font-mono text-[11.5px] font-bold text-ink-900'
  // A blank to write on: the bill's own dashed gold line.
  const LINE = 'w-full min-w-0 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 py-px text-ink-900 placeholder:text-paper-400 placeholder:font-medium focus:outline-none focus:border-solid focus:bg-gold-100 transition-colors'
  const info = LINE + ' text-[11px] font-semibold mt-1'
  const nights = first ? Math.round((new Date(first.checkOut).getTime() - new Date(first.checkIn).getTime()) / 86400000) : 0
  // Rooms whose breakfast is not on the bill yet, offered beside "Add a charge".
  const noBreakfast = list.filter(([id, s]) => {
    const room = s.type === 'room' ? rooms.find(r => r.id === id) : undefined
    return !!room && !breakfast.includes(id)
  })

  return createPortal(
    <div className="fixed inset-0 z-[60] p-3 sm:p-4 bg-slate-900/50 overflow-y-auto bw-dim">
      <div ref={setSheetEl} className="relative bw-eject bill-snap">
        <StatementShell label="Log old booking" invoiceNumber="copied from the paper" onClose={onClose}>
          <BrandHeader>
            <span className={label}>Paper no.</span>
            <input value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="2549-09-0023" aria-label="Registration No. on the paper"
              className={LINE + ' w-[118px] text-right font-mono text-[13px] font-bold'} />
            <span className={label}>Paper date</span>
            <input type="date" value={regOn} onChange={e => setRegOn(e.target.value)} aria-label="Date on the paper"
              className={LINE + ' w-[118px] text-right text-[11.5px] font-semibold'} />
          </BrandHeader>

          <div className="grid grid-cols-2 gap-6 items-start">
            <div>
              <SectionName>Guest</SectionName>
              <input ref={nameBox} value={guestName} onChange={e => setGuestName(e.target.value.toUpperCase())} placeholder="FULL NAME" aria-label="Guest's name"
                className={LINE + ' font-display text-[14.5px] font-bold'} />
              <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} inputMode="tel" placeholder="09xx xxx xxxx" aria-label="Contact no." className={info} />
              <NationalityInput value={nationality} onChange={setNationality} placeholder="Filipino" className={info} />
              {more ? (
                <div className="bw-unfold">
                  <input value={address} onChange={e => setAddress(e.target.value.toUpperCase())} placeholder="ADDRESS" aria-label="Address" className={info} />
                  {companions.map((c, i) => (
                    <div key={i} className="flex items-end gap-1 bw-rise">
                      <input value={c.name} onChange={e => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value.toUpperCase() } : x))}
                        placeholder="COMPANION · JUAN DELA CRUZ" aria-label="Companion's name" className={info} />
                      <button type="button" onClick={() => setCompanions(cs => cs.filter((_, j) => j !== i))} aria-label="Remove companion"
                        className="p-1 text-muted hover:text-danger-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setCompanions(cs => [...cs, { name: '' }])}
                    className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-gold-800 hover:underline cursor-pointer"><Plus className="w-3 h-3" /> Companion</button>
                </div>
              ) : (
                <button type="button" onClick={() => setMore(true)} className="mt-1 text-[10.5px] font-bold text-gold-800 hover:underline cursor-pointer">+ Address, companions</button>
              )}
            </div>

            <div>
              <SectionName>Stay</SectionName>
              {list.length === 0 && <p className="text-[11px] text-muted">Pick the room and the dates on the calendar first.</p>}
              {list.map(([id, s]) => {
                const venue = s.type === 'venue' ? venues.find(v => v.id === id) : undefined
                const kinds = venueTypes(venue)
                const chosen = addons[id]?.venue_type || ''
                const options = venue && kinds.length > 0
                  ? [{ key: '', label: venue.name.split(' ').pop() || venue.name, price: getEffectiveNightlyPrice(venue.base_price, venue.promo_price) },
                    ...kinds.map(t => ({ key: t.key, label: t.label.startsWith(venue.name + ' ') ? t.label.slice(venue.name.length + 1) : t.label, price: Number(t.price) }))]
                  : []
                return (
                  <div key={id}>
                    <p className="font-display text-[14.5px] font-bold text-ink-900 leading-tight">{unitName(id, s)}</p>
                    {options.length > 0 && (
                      <div role="radiogroup" aria-label={venue!.name + ' type'} className="flex flex-wrap gap-1 mt-1">
                        {options.map(o => (
                          <button key={o.key} type="button" role="radio" aria-checked={o.key === chosen} onClick={() => setKind(id, o.key)}
                            className={'px-2 py-0.5 rounded-md text-[10.5px] font-bold border-[1.5px] cursor-pointer active:scale-95 transition-[border-color,background-color,transform] ' +
                              (o.key === chosen ? 'border-ink-900 bg-ink-900 text-white' : 'border-paper-200 text-ink-700 hover:border-gold-400')}>
                            {o.label} <span className="font-mono font-semibold opacity-70">{money(o.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {first && (
                <>
                  {isShort ? (
                    // The hours, circled by hand like the paper form.
                    <div role="radiogroup" aria-label="Hours" className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
                      {HOURS.map(h => (
                        <Circled key={h} on={hours === h} onClick={() => setHours(h)} className="!min-h-0 !py-0.5 !px-2 text-[12px] font-bold text-ink-900">{h} hrs</Circled>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10.5px] font-medium text-ink-900">{nights} {list.every(([, s]) => s.type === 'venue') ? 'day' : 'night'}{nights === 1 ? '' : 's'}</p>
                  )}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 mt-1 pt-1 border-t border-ink-200">
                    <div><p className={label}>Check in</p><p className="text-[12.5px] font-bold text-ink-900 leading-tight">{fmtDay(first.checkIn)}</p></div>
                    {isShort ? <span /> : <p className={label + ' font-bold pt-3.5'}>to</p>}
                    {!isShort && <div><p className={label}>Check out</p><p className="text-[12.5px] font-bold text-ink-900 leading-tight">{fmtDay(first.checkOut)}</p></div>}
                  </div>
                </>
              )}
            </div>
          </div>

          {statement && (
            <StatementChargesTable items={statement.lineItems} onRemove={removeLine} isNew={() => false}>
              {removed && (
                <tr key={removed.label}>
                  <td colSpan={6} className="pt-1 text-[10.5px] font-semibold text-muted bw-rise">
                    {removed.label} taken off · <button type="button" onClick={() => { setBreakfast(removed.breakfast); setAddons(removed.addons); setRemoved(null) }}
                      className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
                  </td>
                </tr>
              )}
              <AddCharge sheet={sheetEl} onCharge={addCharge} cols={6} beside={noBreakfast.map(([id]) => {
                const room = rooms.find(r => r.id === id)!
                const name = 'Breakfast' + (list.length > 1 ? ' · Room ' + room.room_number : '')
                // A room never priced asks for its price right here, as the paper form does
                // (Sebastian, 2026-10-23: "where's breakfast?" — it was hidden for such a room).
                if (pricing === id) return (
                  <span key={id} className="shrink-0 flex items-center gap-1.5 px-2.5 first:pl-0 text-[11px] font-bold text-gold-800 bw-rise">
                    <Coffee aria-hidden="true" className="w-3.5 h-3.5" />{name}
                    <PriceBox className="h-7 text-[12px]" label={null} onBack={() => setPricing(null)}
                      onSave={price => {
                        setPricing(null)
                        updateRoomBreakfastPrice?.(id, price)
                          .catch(() => showToast('The breakfast price for Room ' + room.room_number + ' was not saved. Try again.', 'error'))
                        setBreakfast(b => [...b, id]); setRemoved(null)
                      }} />
                  </span>
                )
                const priced = breakfastSellable(room)
                return (
                  // Breakfast waits beside "Add a charge" and is written onto the bill when tapped
                  // (the mock: the switch on a greyed row "looks" wrong).
                  <button key={id} type="button" onClick={() => { if (!priced) { setPricing(id); return } setBreakfast(b => [...b, id]); setRemoved(null) }}
                    className={ADD}>
                    <Coffee aria-hidden="true" className="w-3.5 h-3.5 group-hover:[animation:bk-hop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]" />
                    {name}
                    <span className="font-mono text-[10px] font-semibold text-muted">{priced ? money(roomBreakfastPrice(room)) + (isShort ? '' : ' a night') : 'Set price'}</span>
                  </button>
                )
              })} />
            </StatementChargesTable>
          )}

          {/* Always two columns, like the bill (card k144: A5 never reaches `sm`). */}
          <div className="grid grid-cols-[1fr_236px] gap-6 items-start">
            <div />
            <div className="relative flex flex-col gap-[3px]">
              <div className="flex justify-between gap-2.5"><span className={label}>Sub-total</span><span className={figure}>{money(subTotal)}</span></div>
              {/* The bill written in ink, like the one bill (the Paper mock, Sebastian, 2026-10-29): the
                  payments are one ledger line with their amount in green, each one under it, and the "+"
                  that writes one hangs in the margin beside it. */}
              <div className="relative">
                {first && (
                  <WritePayment key={paid.length} sheet={sheetEl} open={writing} onOpen={setWriting} gone={!(due > 0)} paidOn={first.checkIn}
                    onPay={p => setPaid(ps => [...ps, { id: 'rcpt-' + Date.now(), ...p }])} />
                )}
                <div className="flex items-baseline py-[3px] border-b border-dotted border-ink-200 text-[10px] font-medium text-ink-900">
                  <span className="flex-1">Less: payments{paid.length > 0 && <span key={paid.length} className="ml-1 text-muted bill-bump">({paid.length})</span>}</span>
                  <span key={paidTotal} className={'w-[62px] text-right font-mono text-[11.5px] font-bold bw-rise ' + (paidTotal > 0 ? 'text-emerald-700' : 'text-muted')}>{paidTotal > 0 ? '−' + money(paidTotal) : '—'}</span>
                </div>
              </div>
              {paid.map(p => (
                <div key={p.id} className="bill-ink">
                  <PayRow purpose={<>{p.purpose}
                    <button type="button" onClick={() => setPaid(ps => ps.filter(x => x.id !== p.id))} aria-label={'Take the ' + p.purpose + ' payment off'}
                      className="ml-0.5 p-0.5 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer"><X className="w-3 h-3" /></button></>}
                    method={paymentMethodLabel(p.method).replace('Bank transfer', 'Bank')} amount={'−' + money(p.amount)} under={shortDay(p.date)} />
                </div>
              ))}
              {paidUp && (
                <span className="bill-paid self-end mt-1.5 mb-0.5 px-[9px] py-0.5 border-2 border-emerald-700 rounded text-[11px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">✓ Paid in full</span>
              )}
              <div className="mt-1.5 -mx-3 px-3 py-1.5 flex items-center justify-between gap-2.5 border-[2.5px] border-ink-900 text-ink-900">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">
                  Amount due
                  {paidTotal > 0 && !paidUp && <span className="block text-[9px] font-normal normal-case tracking-normal mt-px text-muted">Remaining balance</span>}
                </span>
                <span className="font-display text-[24px] font-extrabold leading-none"><CountPeso roll value={due} /></span>
              </div>
            </div>
          </div>

          {/* Prepared by: the receptionist on duty circled, as on the paper form. */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div role="radiogroup" aria-label="Receptionist on duty" className="min-h-6 flex flex-wrap items-end gap-x-3 gap-y-1 pb-0.5 border-b border-ink-900">
                {staffNames.map(n => (
                  <Circled key={n} on={preparedBy === n} onClick={() => { setPreparedBy(n); setTypingStaff(false) }}
                    className={'!min-h-0 !py-0 !px-1.5 text-[12px] font-bold tracking-[0.02em] ' + (preparedBy === n ? 'text-ink-900' : 'text-ink-600')}>{n}</Circled>
                ))}
                {typingStaff || staffNames.length === 0 ? (
                  <input autoFocus={typingStaff} placeholder="NAME" aria-label="Receptionist's name"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') setTypingStaff(false) }}
                    onBlur={e => {
                      const v = e.currentTarget.value.trim().toUpperCase()
                      if (v) { setStaffNames(ns => ns.includes(v) ? ns : [...ns, v]); setPreparedBy(v) }
                      setTypingStaff(false)
                    }}
                    className={LINE + ' !w-24 text-[12px] font-bold'} />
                ) : (
                  <button type="button" onClick={() => setTypingStaff(true)}
                    className="text-[11px] font-bold text-gold-800 hover:underline cursor-pointer inline-flex items-center gap-0.5"><Plus className="w-3 h-3" /> Someone else</button>
                )}
              </div>
              <p className={label + ' mt-0.5'}>Prepared by</p>
            </div>
            <div>
              <p className="h-6 border-b border-ink-900" />
              <p className={label + ' mt-0.5'}>Guest signature</p>
            </div>
          </div>

          {error && <p className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-[13px] rounded-lg bw-nope">{error}</p>}
          <button type="button" onClick={handleSave}
            className="w-full min-h-[54px] rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[16px] font-bold cursor-pointer active:scale-[0.98] transition-[background-color,transform] bw-shine">
            Log booking
          </button>
        </StatementShell>
      </div>
    </div>,
    document.body,
  )
}
