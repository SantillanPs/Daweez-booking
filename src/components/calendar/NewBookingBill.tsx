import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Coffee, Plus, X } from 'lucide-react'
import { Booking, BillCharge, Companion, EquipmentRental, EventAddons, PaymentRecord, Room, Venue } from '../../types/booking'
import { buildStatement, StatementLineItem } from '../../utils/statement'
import { dateToString, normalizeVenueId, randomUUID } from '../../utils/helpers'
import { recomputeBalance } from '../../utils/bookingBalance'
import { readBookingFoodTotal } from '../../utils/orderSlips'
import { focusBookingAfterCreate } from '../../utils/bookingFocus'
import { breakfastSellable, roomBreakfastPrice } from '../../utils/breakfast'
import { venueTypes } from '../../utils/venueTypes'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { lastReceptionist, rememberReceptionist, staffNamesOf } from '../../utils/receptionists'
import { getInstitutions, insertInstitution } from '../../utils/institutions'
import { StatementShell, BrandHeader, SectionName } from '../billing/StatementShell'
import { StatementChargesTable } from '../billing/StatementChargesTable'
import { AddCharge, WritePayment } from '../billing/BillDesk'
import { want } from '../billing/want'
import { NationalityInput } from '../NationalityInput'
import { CountPeso } from '../CountPeso'
import { PriceBox } from '../PriceBox'
import { useDashboardData } from '../DashboardContext'
import { showToast } from '../../utils/toast'
import { submitBookingForm } from '../walk-in/bookingSubmit'
import { ManualBookingInput } from '../walk-in/bookingSubmitTypes'
import { BookingCreatedPanel } from '../walk-in/BookingCreatedPanel'
import { Circled, Sel } from './LogOldBookingModal'

const HOURS = [3, 6, 12, 22] as const
// The room extras the booking form offers, at the form's prices (a night each).
const EXTRAS = [
  { key: 'extraFoamCount', label: 'Foam', price: 200 },
  { key: 'extraPillowCount', label: 'Pillow', price: 50 },
  { key: 'extraBlanketCount', label: 'Blanket', price: 50 },
  { key: 'extraTowelCount', label: 'Towel', price: 50 },
] as const
type ExtraKey = typeof EXTRAS[number]['key']
type Extras = Record<ExtraKey, number>
const NO_EXTRAS: Extras = { extraFoamCount: 0, extraPillowCount: 0, extraBlanketCount: 0, extraTowelCount: 0 }

const money = (n: number) => '₱' + Math.round(n).toLocaleString()
const nextDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return dateToString(new Date(y, m - 1, d + 1)) }
const fmtDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }

interface Paid { amount: number; method: string; reference: string; purpose: string }
/** Who the bill goes to instead of the guest: an agency (its deal) or an institution (a name). */
interface BillTo { name: string; dealId?: string }
interface Discount { pct: boolean; v: number }

/**
 * **A new booking on the billing statement** (Sebastian, 2026-10-23: "what would it look like if we
 * also turned making a new reservation into the billing statement" — the mock, then "apply and make
 * it toggle-able like old booking and reschedule"). The Log old bill with today's money: the bill
 * number waits pale until it is booked, a payment is written on the bill's own line with the booking
 * form's Deposit and Full pay as quick fills, and none written is No deposit. **An agency or an
 * institution is one list** ("make institution and agency as the same thing"): either turns the
 * page into the agency's statement — Bill to, the guest c/o, one Total, Received by. Saved through
 * the booking form's own `submitBookingForm`, so the rooms, prices, receipt and rollback are the
 * form's; nothing is saved until Book.
 */
export function NewBookingBill({ rooms, venues, bookings, allBookings, createManualBooking, updateBooking, cancelBooking, deleteBooking, initialSelections, initialStayHours, editing, onClose }: {
  rooms: Room[]; venues: Venue[]; bookings: Booking[]; allBookings: Booking[]
  createManualBooking: (params: ManualBookingInput) => Promise<Booking>
  updateBooking: (b: Booking) => Promise<void>
  cancelBooking: (id: string) => Promise<void>
  deleteBooking: (id: string) => Promise<void>
  initialSelections?: Record<string, Sel>
  initialStayHours?: number
  /**
   * A booking being corrected (its whole group): the same bill, filled in from what is saved
   * (Sebastian, 2026-10-23: "if it's on the bill, then editing should also be on the bill").
   * Its payments are shown, not taken — more money is received on the booking panel.
   */
  editing?: Booking[]
  onClose: () => void
}) {
  const ed = editing?.[0]
  const unitIdOf = (b: Booking) => b.room_id || normalizeVenueId(b.venue_id) || ''
  const { updateRoomBreakfastPrice, partnerDeals } = useDashboardData()
  const [pricing, setPricing] = useState<string | null>(null)
  const [guestName, setGuestName] = useState(ed?.guest_name || '')
  const [guestPhone, setGuestPhone] = useState(ed?.guest_phone && ed.guest_phone !== 'None' ? ed.guest_phone : '')
  const [nationality, setNationality] = useState(ed?.guest_nationality || '')
  const [address, setAddress] = useState(ed?.guest_address || '')
  const [companions, setCompanions] = useState<Companion[]>(ed?.companions || [])
  const [more, setMore] = useState(!!ed?.guest_address || !!ed?.companions?.length)
  const [hours, setHours] = useState<number>(initialStayHours || ed?.stay_hours || 3)
  const [breakfast, setBreakfast] = useState<string[]>(() => (editing || []).filter(b => b.room_id && b.breakfast_included).map(unitIdOf))
  const [extras, setExtras] = useState<Extras>(() => {
    const r = editing?.find(b => b.room_id && b.equipment_rentals)?.equipment_rentals
    return r ? { extraFoamCount: r.extraFoamCount || 0, extraPillowCount: r.extraPillowCount || 0, extraBlanketCount: r.extraBlanketCount || 0, extraTowelCount: r.extraTowelCount || 0 } : NO_EXTRAS
  })
  // Every charge of the booking, wherever it was written — saved back onto the first unit.
  const [charges, setCharges] = useState<BillCharge[]>(() => (editing || []).flatMap(b => b.event_addons?.charges || []))
  const [kinds, setKinds] = useState<Record<string, string>>(() =>
    Object.fromEntries((editing || []).filter(b => b.venue_id && b.event_addons?.venue_type).map(b => [unitIdOf(b), b.event_addons!.venue_type!])))
  // As the form reads it back: a flat amount is what the rooms' shares add up to.
  const [disc, setDisc] = useState<Discount | null>(() => {
    const d = editing?.find(b => (b.applied_discount?.value || 0) > 0)?.applied_discount
    if (!d) return null
    return d.type === 'flat'
      ? { pct: false, v: editing!.reduce((a, b) => a + (b.applied_discount?.type === 'flat' ? Number(b.applied_discount.value || 0) : 0), 0) }
      : { pct: true, v: d.value }
  })
  const [removed, setRemoved] = useState<{ label: string; breakfast: string[]; extras: Extras; charges: BillCharge[]; disc: Discount | null } | null>(null)
  const [to, setTo] = useState<BillTo | null>(() =>
    ed?.partner_deal_id || ed?.company_name ? { name: ed.company_name || '', dealId: ed.partner_deal_id || undefined }
      : ed?.institution ? { name: ed.institution } : null)
  const [picking, setPicking] = useState(false)
  const [institutions, setInstitutions] = useState<string[]>([])
  const [paid, setPaid] = useState<Paid | null>(null)
  const [writing, setWriting] = useState(false)
  const [preparedBy, setPreparedBy] = useState(() => ed ? ed.prepared_by || '' : lastReceptionist())
  const [staffNames, setStaffNames] = useState(() => staffNamesOf(bookings))
  const [typingStaff, setTypingStaff] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ list: Booking[]; receipt: PaymentRecord | null; from: { x: number; y: number; w: number; h: number } | null } | null>(null)
  const nameBox = useRef<HTMLInputElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => { getInstitutions().then(l => setInstitutions(l.map(i => i.name))).catch(() => {}) }, [])

  // Rooms before venues, the order they are saved in, so the charges sit on the same unit here and there.
  const entries = (editing
    ? editing.map((b): [string, Sel] => [unitIdOf(b), { checkIn: b.check_in, checkOut: b.check_out, type: b.room_id ? 'room' : 'venue' }])
    : Object.entries(initialSelections || {})
  ).sort((a, b) => (a[1].type === 'room' ? 0 : 1) - (b[1].type === 'room' ? 0 : 1))
  const isShort = !!(initialStayHours || ed?.stay_hours) && entries[0]?.[1].type === 'room'
  const list: [string, Sel][] = isShort ? [[entries[0][0], { ...entries[0][1], checkOut: nextDay(entries[0][1].checkIn) }]] : entries
  const first = list[0]?.[1]
  const firstRoomId = list.find(([, s]) => s.type === 'room')?.[0]
  const deal = partnerDeals.find(d => d.id === to?.dealId)

  // The rooms as bookings that do not exist yet, priced by the real statement builder — with
  // what the form would save on them: the agency's rate, the extras on the first room, the
  // charges on the first unit, the discount (a flat amount once, on the first).
  const draftOf = (id: string, s: Sel, i: number): Booking => {
    const ea: EventAddons = {}
    if (kinds[id]) ea.venue_type = kinds[id]
    if (i === 0 && charges.length > 0) ea.charges = charges
    const rentals: EquipmentRental | undefined = id === firstRoomId && !to
      ? { bigTableCount: 0, smallTableCount: 0, chairCount: 0, mineralWaterCount: 0, ...extras } : undefined
    // A correction starts from the saved row, so its payments, breakfasts and hours stay on the bill.
    const saved = editing?.find(b => unitIdOf(b) === id)
    return {
      security_deposit: 0, created_at: '', expires_at: null,
      ...saved,
      id: 'draft-' + id, room_id: s.type === 'room' ? id : undefined, venue_id: s.type === 'venue' ? id : undefined,
      guest_name: guestName, guest_email: '', guest_phone: '', check_in: s.checkIn, check_out: s.checkOut,
      source: 'manual', status: 'confirmed', payment_records: saved?.payment_records || [], downpayment_paid: saved?.downpayment_paid || 0, balance_due: 0,
      breakfast_included: breakfast.includes(id) || (s.type === 'room' && deal?.breakfast_default === 'with'),
      stay_hours: isShort ? hours : undefined,
      event_addons: Object.keys(ea).length > 0 ? ea : undefined,
      equipment_rentals: rentals,
      partner_deal_id: deal?.id, company_name: to?.name, contract_rate_override: deal?.contracted_rates[id] || undefined,
      applied_discount: disc && disc.v > 0 && !to && (disc.pct || i === 0) ? { type: disc.pct ? 'percent' : 'flat', value: disc.v } : undefined,
    } as Booking
  }
  const drafts = list.map(([id, s], i) => draftOf(id, s, i))
  const statement = drafts.length > 0
    ? buildStatement({ primaryBooking: drafts[0], relatedBookings: drafts, rooms, venues, bookingsList: bookings })
    : null
  const total = statement?.subTotal ?? 0
  const received = editing ? (statement?.payments || []).reduce((a, x) => a + x.amount, 0) : paid?.amount ?? 0
  const due = Math.max(0, total - received)
  const paidUp = received > 0 && due === 0

  const snapshot = (label: string) => setRemoved({ label, breakfast, extras, charges, disc })
  const unitOf = (key: string) => list.find(([id]) => key.startsWith('draft-' + id + '-'))?.[0]
  const removeLine = (line: StatementLineItem) => {
    const id = unitOf(line.key), r = line.remove
    if (!id || !r) return
    snapshot(line.description)
    if ('breakfast_included' in r) setBreakfast(b => b.filter(x => x !== id))
    if (r.equipment_rentals) setExtras(e => { const n = { ...e }; EXTRAS.forEach(x => { n[x.key] = Number(r.equipment_rentals![x.key] || 0) }); return n })
    if (r.event_addons) setCharges(r.event_addons.charges || [])
    if (r.applied_discount) setDisc(null)
  }
  const undo = () => { if (!removed) return; setBreakfast(removed.breakfast); setExtras(removed.extras); setCharges(removed.charges); setDisc(removed.disc); setRemoved(null) }
  const addCharge = (name: string, amount: number) => {
    if (!first) return
    setCharges(c => [...c, { id: randomUUID(), name, amount, date: first.checkIn }])
    setRemoved(null)
  }

  const pickTo = (raw: string) => {
    const name = raw.trim().toUpperCase()
    setPicking(false)
    if (!name) return
    const d = partnerDeals.find(x => x.name.trim().toUpperCase() === name)
    if (d) { setTo({ name: d.name, dealId: d.id }); setPaid(null); setWriting(false); return }
    const known = institutions.find(n => n.trim().toUpperCase() === name)
    setTo({ name: known || name }); setPaid(null); setWriting(false)
    // A name not in either list is kept as a new institution, as the form's list does.
    if (!known) insertInstitution(name).then(i => setInstitutions(l => [...l, i.name]))
      .catch(() => showToast(name + ' was not added to the list. It is still on this booking.', 'error'))
  }

  const handleBook = async () => {
    if (!to && !guestName.trim()) { want(nameBox.current); return }
    if (list.length === 0) { setError('Pick the room and the dates on the calendar first.'); return }
    setError(''); setSaving(true)
    const at = sheet.current?.getBoundingClientRect()
    const plan = ed ? ed.payment_plan || 'reservation' : !paid ? 'reservation' : paid.amount >= total ? 'full' : 'custom'
    const sum = (f: (b: Booking) => number) => (editing || []).reduce((a, b) => a + f(b), 0)
    const venueKit = editing?.find(b => b.venue_id && b.equipment_rentals)?.equipment_rentals
    const result = await submitBookingForm({
      unitSelections: Object.fromEntries(list),
      formRoomIds: new Set(list.filter(([, s]) => s.type === 'room').map(([id]) => id)),
      formVenueIds: new Set(list.filter(([, s]) => s.type === 'venue').map(([id]) => id)),
      rooms, venues, allBookings, partnerDeals,
      activeBookings: editing ? bookings.filter(b => !editing.some(e => e.id === b.id)) : bookings,
      formPartnerDealId: deal?.id || '',
      bookingType: to ? 'partner' : 'individual',
      formStatus: 'confirmed',
      // As the form: an agency's stay is confirmed by its contract, a guest's by the money.
      // A correction keeps the status the booking already had (the form's rule).
      bookingStatus: to || (ed && ed.status !== 'pending') ? 'confirmed' : 'pending',
      formAgreedDeposit: ed ? ed.agreed_deposit ?? 0 : paid?.amount || 0,
      formGuestName: guestName.trim(), formGuestEmail: ed?.guest_email || deal?.email || '', formGuestPhone: guestPhone.trim(),
      formGuestGender: ed?.guest_gender || '', formGuestNationality: nationality.trim(), formGuestAddress: address.trim(), formBirthdate: ed?.birthdate || '',
      formPreparedBy: preparedBy.trim(),
      formCompanyName: to?.name || '', formInstitution: to && !to.dealId ? to.name : ed?.institution || '',
      formVehiclePlate: ed?.vehicle_plate || deal?.vehicle_plate || '', formInvoiceNumber: ed?.invoice_number || '', formSource: ed?.source || 'manual',
      formBreakfastRoomIds: breakfast, formCompanions: companions.filter(c => c.name.trim()),
      ...extrasOf(to ? NO_EXTRAS : extras),
      // What the bill does not show is sent back as saved, or the save would blank it.
      formChairs: venueKit?.chairCount || 0, formEventTable: venueKit?.tableCount || 0, formEventTent: venueKit?.tentCount || 0,
      formVenueExcessHours: ed?.venue_excess_hours || 0, formBlockNotes: ed?.notes || '', venueDayBlocks: ed?.venue_day_blocks || undefined,
      discountType: !disc || !disc.v || to ? 'none' : disc.pct ? 'percent' : 'flat', discountValue: disc?.v || 0,
      formVenueTypes: kinds,
      formPaymentMethod: ed ? ed.payment_method || '' : paid?.method || '', formPaymentReference: ed ? ed.payment_reference || '' : paid?.reference || '',
      formPaymentPlan: plan, formPaymentPurpose: paid?.purpose,
      formCharges: charges,
      stay_hours: isShort ? hours : undefined,
      editingBookings: editing,
      // Each room keeps its own money; the balance is worked out again below.
      derivedPaymentStatus: ed ? ed.payment_status || 'unpaid' : 'unpaid',
      formDownpaymentPaid: sum(b => Number(b.downpayment_paid || 0)),
      formBalanceDue: ed ? sum(b => Number(b.balance_due || 0)) : null,
      formSecurityDeposit: ed ? sum(b => Number(b.security_deposit || 0)) : null,
      receivedAmount: paid?.amount || 0,
      createManualBooking, updateBooking, cancelBooking, deleteBooking,
    })
    if (!result.ok) { setSaving(false); setError(result.error); return }
    if (editing) {
      // The form keeps the balance it was handed; a charge taken off here has to come off
      // what is owed too, so each room is priced again: stay + food − money received.
      try {
        for (const b of result.bookings) {
          const priced = recomputeBalance(b, { rooms, venues, tabTotal: await readBookingFoodTotal(b.id) })
          if (priced.balance_due !== b.balance_due || priced.payment_status !== b.payment_status) await updateBooking(priced)
        }
      } catch {
        showToast('The changes are saved, but the balance was not worked out again. Open the booking and try again.', 'error')
      }
      focusBookingAfterCreate(result.bookings[0]?.id)
      onClose()
      return
    }
    setSaving(false)
    if (preparedBy.trim()) rememberReceptionist(preparedBy)
    setCreated({ list: result.bookings, receipt: result.receipt ?? null, from: at ? { x: at.left, y: at.top, w: at.width, h: at.height } : null })
  }

  if (created) {
    return createPortal(
      <BookingCreatedPanel createdBookingList={created.list} rooms={rooms} venues={venues} bookings={bookings}
        receipt={created.receipt} from={created.from} onClose={onClose} />,
      document.body,
    )
  }

  const unitName = (id: string, s: Sel) => s.type === 'room'
    ? ['Room ' + (rooms.find(r => r.id === id)?.room_number ?? ''), rooms.find(r => r.id === id)?.name].filter(Boolean).join(' · ')
    : venues.find(v => v.id === id)?.name || id

  const label = 'text-[10px] text-muted'
  const figure = 'font-mono text-[11.5px] font-bold text-ink-900'
  const LINE = 'w-full min-w-0 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 py-px text-ink-900 placeholder:text-paper-400 placeholder:font-medium focus:outline-none focus:border-solid focus:bg-gold-100 transition-colors'
  const info = LINE + ' text-[11px] font-semibold mt-1'
  const nights = first ? Math.round((new Date(first.checkOut).getTime() - new Date(first.checkIn).getTime()) / 86400000) : 0
  const noBreakfast = list.filter(([id, s]) => s.type === 'room' && !!rooms.find(r => r.id === id) && !breakfast.includes(id) && !(to && deal?.breakfast_default === 'with'))
  const today = new Date()
  const book = ed ? '' : to ? 'Agency pays' : !paid ? 'No deposit' : paidUp ? 'Paid in full' : money(paid.amount) + ' deposit'

  return createPortal(
    <div className="fixed inset-0 z-[60] p-3 sm:p-4 bg-slate-900/50 overflow-y-auto bw-dim">
      <div ref={sheet} className="bw-eject">
        <StatementShell label={(ed ? 'Edit booking' : 'New booking') + (to ? ' · agency' : '')} invoiceNumber={ed?.invoice_number || 'numbered when booked'} onClose={onClose}>
          <BrandHeader dateIssued={today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}>
            <span className={label + ' row-start-1'}>Bill no.</span>
            {ed?.invoice_number
              ? <span className="row-start-1 font-mono text-[13px] font-bold text-ink-900">{ed.invoice_number}</span>
              : <span className="row-start-1 font-mono text-[13px] font-bold text-paper-400">GRF-{today.getFullYear()}-{String(today.getMonth() + 1).padStart(2, '0')}-…</span>}
          </BrandHeader>

          <div className="grid grid-cols-2 gap-6 items-start">
            <div>
              <SectionName>{to ? 'Bill to' : 'Guest'}</SectionName>
              {/* One list for agencies and institutions, above the name (Sebastian, 2026-10-23). */}
              {to ? (
                <div className="bw-rise">
                  <p className="flex items-center gap-1.5 font-display text-[14.5px] font-bold text-ink-900 leading-tight">
                    <Building2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />{to.name}
                    <button type="button" onClick={() => setTo(null)} aria-label={'Not billed to ' + to.name}
                      className="p-0.5 rounded text-muted opacity-60 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer"><X className="w-3 h-3" /></button>
                  </p>
                  <span className={label}>c/o</span>
                </div>
              ) : picking ? (
                <div className="flex items-end gap-1 bw-unfold">
                  <input autoFocus list="bill-to-list" placeholder="SURIGAO SUN TOURS or DEPED TANDAG" aria-label="Agency or institution"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pickTo(e.currentTarget.value) } if (e.key === 'Escape') setPicking(false) }}
                    onBlur={e => pickTo(e.currentTarget.value)} className={info + ' !mt-0 uppercase'} />
                  <datalist id="bill-to-list">
                    {[...partnerDeals.map(d => d.name), ...institutions].map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
              ) : (
                <button type="button" onClick={() => setPicking(true)} className="mb-0.5 inline-flex items-center gap-1 text-[10.5px] font-bold text-gold-800 hover:underline cursor-pointer">
                  <Plus className="w-3 h-3" /> Agency or institution
                </button>
              )}
              <input ref={nameBox} value={guestName} onChange={e => setGuestName(e.target.value.toUpperCase())} placeholder="FULL NAME · MARICEL ABRENICA" aria-label="Guest's name"
                className={LINE + ' font-display text-[14.5px] font-bold'} />
              <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} inputMode="tel" placeholder="0917 482 3361" aria-label="Contact no." className={info} />
              <NationalityInput value={nationality} onChange={setNationality} placeholder="Filipino" className={info} />
              {more ? (
                <div className="bw-unfold">
                  <input value={address} onChange={e => setAddress(e.target.value.toUpperCase())} placeholder="SAN AGUSTIN, TANDAG CITY" aria-label="Address" className={info} />
                  {companions.map((c, i) => (
                    <div key={i} className="flex items-end gap-1 bw-rise">
                      <input value={c.name} onChange={e => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value.toUpperCase() } : x))}
                        placeholder="COMPANION · LIZA MONTEJO" aria-label="Companion's name" className={info} />
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
                const types = venueTypes(venue)
                const chosen = kinds[id] || ''
                const options = venue && types.length > 0
                  ? [{ key: '', label: venue.name.split(' ').pop() || venue.name, price: getEffectiveNightlyPrice(venue.base_price, venue.promo_price) },
                    ...types.map(t => ({ key: t.key, label: t.label.startsWith(venue.name + ' ') ? t.label.slice(venue.name.length + 1) : t.label, price: Number(t.price) }))]
                  : []
                return (
                  <div key={id}>
                    <p className="font-display text-[14.5px] font-bold text-ink-900 leading-tight">{unitName(id, s)}</p>
                    {options.length > 0 && (
                      <div role="radiogroup" aria-label={venue!.name + ' type'} className="flex flex-wrap gap-1 mt-1">
                        {options.map(o => (
                          <button key={o.key} type="button" role="radio" aria-checked={o.key === chosen} onClick={() => setKinds(k => ({ ...k, [id]: o.key }))}
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
                    {removed.label} taken off · <button type="button" onClick={undo} className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
                  </td>
                </tr>
              )}
              <AddCharge onCharge={addCharge} cols={6}
                // The form's room extras, a tap for each one more; an agency's stay has none.
                presets={firstRoomId && !to ? EXTRAS.map(x => ({ label: x.label, price: x.price, onPick: () => { setExtras(e => ({ ...e, [x.key]: e[x.key] + 1 })); setRemoved(null) } })) : undefined}
                beside={noBreakfast.map(([id]) => {
                  const room = rooms.find(r => r.id === id)!
                  const name = 'Breakfast' + (list.length > 1 ? ' · Room ' + room.room_number : '')
                  if (pricing === id) return (
                    <span key={id} className="shrink-0 flex items-center gap-1.5 px-2 rounded-md border-[1.5px] border-gold-400 bg-gold-100 text-[11px] font-bold text-gold-800 bw-rise">
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
                    <button key={id} type="button" onClick={() => { if (!priced) { setPricing(id); return } setBreakfast(b => [...b, id]); setRemoved(null) }}
                      className="group bill-blank shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md border-[1.5px] border-dashed border-gold-300 bg-paper-50 text-[11px] font-bold text-gold-800 hover:bg-gold-100 hover:border-gold-400 active:scale-[0.98] transition-[background-color,border-color,transform] cursor-pointer">
                      <Coffee aria-hidden="true" className="w-3.5 h-3.5 group-hover:[animation:bk-hop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]" />
                      {name}
                      <span className="font-mono text-[10px] font-semibold text-muted">{priced ? money(roomBreakfastPrice(room)) + (isShort ? '' : ' a night') : 'Set price'}</span>
                    </button>
                  )
                })} />
            </StatementChargesTable>
          )}

          <div className="grid grid-cols-[1fr_236px] gap-6 items-start">
            <div />
            <div className="relative flex flex-col gap-0.5">
              {!to && (
                <>
                  <div className="flex justify-between gap-2.5"><span className={label}>Sub-total</span><span className={figure}>{money(total)}</span></div>
                  {disc ? (
                    <DiscountBox disc={disc} onChange={setDisc} />
                  ) : (
                    <button type="button" onClick={() => setDisc({ pct: true, v: 0 })} className="self-start text-[10.5px] font-bold text-gold-800 hover:underline cursor-pointer">+ Discount</button>
                  )}
                  <p className={label}>Less: payments received</p>
                  {editing && statement?.payments.map(x => (
                    <div key={x.key} className="flex justify-between items-baseline gap-2.5">
                      <span className={label + ' min-w-0'}>
                        {new Date(x.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {paymentMethodLabel(x.method)}{x.purpose && <> · <span className="font-bold text-ink-900">{x.purpose}</span></>}
                      </span>
                      <span className={figure + ' shrink-0'}>−{money(x.amount)}</span>
                    </div>
                  ))}
                  {paid && (
                    <div className="flex justify-between items-baseline gap-2.5 bill-ink">
                      <span className={label + ' min-w-0'}>
                        Today · {paymentMethodLabel(paid.method)} · <span className="font-bold text-ink-900">{paid.purpose}</span>
                        <button type="button" onClick={() => setPaid(null)} aria-label={'Take the ' + paid.purpose + ' payment off'}
                          className="ml-0.5 p-0.5 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer"><X className="w-3 h-3" /></button>
                      </span>
                      <span className={figure + ' shrink-0'}>−{money(paid.amount)}</span>
                    </div>
                  )}
                  {/* One payment at booking — what the guest hands over now; more is taken on the panel. */}
                  {!editing && !paid && total > 0 && (
                    <WritePayment open={writing} onOpen={setWriting} again={false}
                      fills={[{ label: 'Deposit', amount: Math.round(total / 2) }, { label: 'Full pay', amount: total }]}
                      onPay={p => setPaid({ amount: p.amount, method: p.method, reference: p.reference, purpose: p.purpose })} />
                  )}
                </>
              )}
              <div className={'mt-1 -mx-3 px-3 py-1.5 flex items-center justify-between gap-2.5 text-white transition-colors duration-500 ' + (paidUp ? 'bg-emerald-700' : 'bg-ink-900')}>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">
                  {to ? 'Total' : 'Amount due'}
                  {received > 0 && <span className="block text-[9px] font-normal normal-case tracking-normal mt-px">{paidUp ? 'Paid in full' : 'Remaining balance'}</span>}
                </span>
                <span className="font-display text-[24px] font-extrabold leading-none"><CountPeso value={to ? total : due} /></span>
              </div>
              {/* Nothing written and nobody else paying: said once, in blue, like the calendar's pill. */}
              {!to && received === 0 && !writing && <p className="mt-0.5 text-right text-[11px] font-bold text-sky-700 bw-rise">No deposit</p>}
              {paidUp && (
                <span aria-hidden="true"
                  className="bill-stamp pointer-events-none absolute right-full mr-8 top-4 px-3 py-0.5 rounded-lg border-[3px] border-emerald-700 text-emerald-700 font-display text-[26px] font-extrabold tracking-[0.12em] opacity-85 mix-blend-multiply">
                  PAID
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div role="radiogroup" aria-label="Receptionist on duty" className="min-h-6 flex flex-wrap items-end gap-x-3 gap-y-1 pb-0.5 border-b border-ink-900">
                {staffNames.map(n => (
                  <Circled key={n} on={preparedBy === n} onClick={() => { setPreparedBy(n); setTypingStaff(false) }}
                    className={'!min-h-0 !py-0 !px-1.5 text-[12px] font-bold tracking-[0.02em] ' + (preparedBy === n ? 'text-ink-900' : 'text-ink-600')}>{n}</Circled>
                ))}
                {typingStaff || staffNames.length === 0 ? (
                  <input autoFocus={typingStaff} placeholder="NAME · ANNA" aria-label="Receptionist's name"
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
              <p className={label + ' mt-0.5'}>{to ? 'Received by' : 'Guest signature'}</p>
            </div>
          </div>

          {error && <p className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-[13px] rounded-lg bw-nope">{error}</p>}
          <button type="button" onClick={() => { if (!saving) handleBook() }}
            className="w-full min-h-[54px] rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[16px] font-bold cursor-pointer active:scale-[0.98] transition-[background-color,transform] bw-shine">
            {ed ? 'Save changes' : <>Book <span key={book} className="text-[13px] font-semibold opacity-75 inline-block bw-rise">· {book}</span></>}
          </button>
        </StatementShell>
      </div>
    </div>,
    document.body,
  )
}

const extrasOf = (e: Extras) => ({
  formExtraFoam: e.extraFoamCount, formExtraPillow: e.extraPillowCount, formExtraBlanket: e.extraBlanketCount, formExtraTowel: e.extraTowelCount,
})

/** "+ Discount" opened: % or ₱, the sign on the side it is read (the mock: % after, ₱ before). */
function DiscountBox({ disc, onChange }: { disc: Discount; onChange: (d: Discount | null) => void }) {
  return (
    <div className="flex items-center gap-1.5 my-0.5 bw-unfold">
      <div role="group" aria-label="Discount by" className="relative grid grid-cols-2 p-0.5 rounded-md bg-card shadow-[inset_0_0_0_1.5px_#1C1C1C]">
        <span aria-hidden="true" style={{ '--i': disc.pct ? 0 : 1 } as React.CSSProperties}
          className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/2)] rounded bg-ink-900 translate-x-[calc(var(--i)*100%)] transition-transform duration-300 ease-[cubic-bezier(.34,1.4,.64,1)]" />
        {[true, false].map(p => (
          <button key={String(p)} type="button" aria-pressed={disc.pct === p} onClick={() => onChange({ ...disc, pct: p })}
            className={'relative w-7 min-h-6 text-[11px] font-bold transition-colors cursor-pointer ' + (disc.pct === p ? 'text-white' : 'text-ink-900')}>{p ? '%' : '₱'}</button>
        ))}
      </div>
      <label className="flex-1 flex items-baseline gap-0.5 border-b-2 border-ink-900 focus-within:border-gold-400 transition-colors">
        {!disc.pct && <span className="font-display text-[11px] font-extrabold text-muted bw-rise">₱</span>}
        <input autoFocus inputMode="numeric" placeholder={disc.pct ? '10' : '200'} aria-label="Discount"
          value={disc.v ? disc.v.toLocaleString() : ''}
          onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')) || 0; onChange({ ...disc, v: disc.pct ? Math.min(n, 100) : n }) }}
          className="min-w-0 w-full bg-transparent border-0 p-0 text-right font-mono text-[13px] font-bold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        {disc.pct && <span className="font-mono text-[12px] font-bold text-muted bw-rise">%</span>}
      </label>
      <button type="button" onClick={() => onChange(null)} aria-label="No discount"
        className="p-0.5 rounded text-muted opacity-60 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer"><X className="w-3 h-3" /></button>
    </div>
  )
}
