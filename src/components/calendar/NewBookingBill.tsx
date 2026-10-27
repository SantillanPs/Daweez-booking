import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronDown, Coffee, Plus, X } from 'lucide-react'
import { Booking, BillCharge, Companion, EquipmentRental, EventAddons, Room, Venue } from '../../types/booking'
import { buildStatement, StatementLineItem, shortDate } from '../../utils/statement'
import { dateToString, normalizeVenueId, randomUUID } from '../../utils/helpers'
import { recomputeBalance } from '../../utils/bookingBalance'
import { readBookingFoodTotal } from '../../utils/orderSlips'
import { focusBookingAfterCreate } from '../../utils/bookingFocus'
import { breakfastSellable, roomBreakfastPrice } from '../../utils/breakfast'
import { venueTypes } from '../../utils/venueTypes'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { getSlipsByBooking, OrderSlip } from '../../utils/orderSlips'
import { groupOf, unitOfLine } from '../../utils/bookingGroup'
import { guestEmailOf } from '../../utils/emailDocument'
import { lastReceptionist, rememberReceptionist, staffNamesOf } from '../../utils/receptionists'
import { getInstitutions, insertInstitution } from '../../utils/institutions'
import { StatementShell, BrandHeader, SectionName } from '../billing/StatementShell'
import { StatementChargesTable } from '../billing/StatementChargesTable'
import { Floating, UnitList, UnitOption, KindList, BreakfastList, MonthPick } from './BillRoomLines'
import { isRoomAvailable, isVenueRangeAvailable } from '../../utils/availability'
import { withMoneyOf, holdsMoney } from '../../utils/roomTakenOff'
import { AddCharge, PayInput, WritePayment } from '../billing/BillDesk'
import type { PaymentPatch } from '../walk-in/bookingPayment'
import { FixPayment, PayRow } from '../billing/FixPayment'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { printA5 } from '../../utils/printA5'
import { want } from '../billing/want'
import { NationalityInput } from '../NationalityInput'
import { CountPeso } from '../CountPeso'
import { useDashboardData } from '../DashboardContext'
import { showToast } from '../../utils/toast'
import { submitBookingForm } from '../walk-in/bookingSubmit'
import { ManualBookingInput } from '../walk-in/bookingSubmitTypes'
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
const dayOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const sortUnits = (l: [string, Sel][]) => [...l].sort((a, b) => (a[1].type === 'room' ? 0 : 1) - (b[1].type === 'room' ? 0 : 1))
const nextDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return dateToString(new Date(y, m - 1, d + 1)) }
// Long enough for the cache's change to reach the booking panel's own handlers.
const settle = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r)))
const fmtDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }

interface Paid { amount: number; method: string; reference: string; purpose: string }
/** Who the bill goes to instead of the guest: an agency (its deal) or an institution (a name). */
interface BillTo { name: string; dealId?: string }
export interface Discount { pct: boolean; v: number }

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
export function NewBookingBill({ rooms, venues, bookings, allBookings, createManualBooking, updateBooking, cancelBooking, deleteBooking, initialSelections, initialStayHours, initialStayHalf, editing, desk, onSaved, onBooked, onClose }: {
  rooms: Room[]; venues: Venue[]; bookings: Booking[]; allBookings: Booking[]
  createManualBooking: (params: ManualBookingInput) => Promise<Booking>
  updateBooking: (b: Booking) => Promise<void>
  cancelBooking: (id: string) => Promise<void>
  deleteBooking: (id: string) => Promise<void>
  initialSelections?: Record<string, Sel>
  initialStayHours?: number
  /** The half of the day picked for a short stay: 0 the morning, 1 the afternoon. */
  initialStayHalf?: 0 | 1
  /**
   * A booking being corrected (its whole group): the same bill, filled in from what is saved
   * (Sebastian, 2026-10-23: "if it's on the bill, then editing should also be on the bill").
   * **It is the one bill** (Sebastian, 2026-10-24: "no more view billing or receive money. merge
   * everything"): every change is saved as it is made, and money is taken on it through `desk`.
   */
  editing?: Booking[]
  /** The booking panel's own money handlers: write a payment, fix one, show its receipt. */
  desk?: {
    onReceipt: (receipt: string) => void
    onPay: (p: PayInput) => Promise<void> | void
    onFix: (key: string, patch: PaymentPatch) => Promise<void> | void
  }
  /** The rows as saved, after each save of a correction (a swapped room is a new row). */
  onSaved?: (rows: Booking[]) => void
  /** A new booking was made: the calendar opens its one bill. */
  onBooked?: (rows: Booking[]) => void
  onClose: () => void
}) {
  const ed = editing?.[0]
  const unitIdOf = (b: Booking) => b.room_id || normalizeVenueId(b.venue_id) || ''
  // Each saved row's line key (`unitOfLine`): its unit's id, `id~row` for the same unit again.
  const keyOfRow = new Map<string, string>()
  for (const b of editing || []) { const id = unitIdOf(b); keyOfRow.set(b.id, [...keyOfRow.values()].includes(id) ? id + '~' + b.id : id) }
  const keyOf = (b: Booking) => keyOfRow.get(b.id) || unitIdOf(b)
  const rowOf = (key: string) => editing?.find(b => keyOf(b) === key || key.endsWith('~' + b.id))
  const { updateRoomBreakfastPrice, partnerDeals } = useDashboardData()
  const [pricing, setPricing] = useState<string | null>(null)
  const [guestName, setGuestName] = useState(ed?.guest_name || '')
  const [guestPhone, setGuestPhone] = useState(ed?.guest_phone && ed.guest_phone !== 'None' ? ed.guest_phone : '')
  const [nationality, setNationality] = useState(ed?.guest_nationality || '')
  const [address, setAddress] = useState(ed?.guest_address || '')
  const [companions, setCompanions] = useState<Companion[]>(ed?.companions || [])
  const [more, setMore] = useState(!!ed?.guest_address || !!ed?.companions?.length)
  const [hours, setHours] = useState<number>(initialStayHours || ed?.stay_hours || 3)
  const [breakfast, setBreakfast] = useState<string[]>(() => (editing || []).filter(b => b.room_id && b.breakfast_included).map(keyOf))
  const [extras, setExtras] = useState<Extras>(() => {
    const r = editing?.find(b => b.room_id && b.equipment_rentals)?.equipment_rentals
    return r ? { extraFoamCount: r.extraFoamCount || 0, extraPillowCount: r.extraPillowCount || 0, extraBlanketCount: r.extraBlanketCount || 0, extraTowelCount: r.extraTowelCount || 0 } : NO_EXTRAS
  })
  // Every charge of the booking, wherever it was written — saved back onto the first unit.
  const [charges, setCharges] = useState<BillCharge[]>(() => (editing || []).flatMap(b => b.event_addons?.charges || []))
  const [kinds, setKinds] = useState<Record<string, string>>(() =>
    Object.fromEntries((editing || []).filter(b => b.venue_id && b.event_addons?.venue_type).map(b => [keyOf(b), b.event_addons!.venue_type!])))
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
  const nameBox = useRef<HTMLInputElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  // The lists float inside the bill's own sheet, so they are drawn once it is there.
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null)
  // **Rooms on the bill** (the mock, Sebastian, 2026-10-24): the rooms and venues are the bill's own
  // lines, each with its own dates and rate, swapped, added or taken off right here.
  const [units, setUnits] = useState<[string, Sel][]>(() => sortUnits(editing
    ? editing.map((b): [string, Sel] => [keyOf(b), { checkIn: b.check_in, checkOut: b.check_out, type: b.room_id ? 'room' : 'venue' }])
    : Object.entries(initialSelections || {})))
  // A rate typed on the line; an agency's own rate is not one.
  const [rates, setRates] = useState<Record<string, number>>(() => Object.fromEntries((editing || [])
    .filter(b => b.contract_rate_override != null && !b.partner_deal_id).map(b => [keyOf(b), Number(b.contract_rate_override)])))
  const [pop, setPop] = useState<{ kind: 'swap' | 'add' | 'kind' | 'bf' | 'in' | 'out'; id: string; at: HTMLElement } | null>(null)
  const [rateBox, setRateBox] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [unitOff, setUnitOff] = useState<{ label: string; money: number; units: [string, Sel][]; breakfast: string[]; kinds: Record<string, string>; rates: Record<string, number> } | null>(null)
  // A room added asks for its own dates (decided 2026-10-24): its check-in month opens once it is drawn.
  const [askIn, setAskIn] = useState<string | null>(null)
  useEffect(() => {
    if (!askIn) return
    const at = sheet.current?.querySelector<HTMLElement>('[data-in="' + askIn + '"]')
    if (at) setPop({ kind: 'in', id: askIn, at })
    setAskIn(null)
  }, [askIn])

  useEffect(() => { getInstitutions().then(l => setInstitutions(l.map(i => i.name))).catch(() => {}) }, [])
  // The food on a correction's rooms, so its Amount due is the panel's.
  const [slips, setSlips] = useState<Record<string, OrderSlip[]>>({})
  const savedIds = (editing || []).map(b => b.id).join(',')
  useEffect(() => { if (savedIds) getSlipsByBooking(savedIds.split(',')).then(setSlips).catch(() => {}) }, [savedIds])

  const isShort = !!(initialStayHours || ed?.stay_hours) && units[0]?.[1].type === 'room'
  const half = initialStayHalf ?? ed?.stay_half ?? 1
  const list: [string, Sel][] = isShort ? [[units[0][0], { ...units[0][1], checkOut: nextDay(units[0][1].checkIn) }]] : units
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
    const unit = unitOfLine(id)
    const rentals: EquipmentRental | undefined = id === firstRoomId && !to
      ? { bigTableCount: 0, smallTableCount: 0, chairCount: 0, mineralWaterCount: 0, ...extras } : undefined
    // A correction starts from the saved row, so its payments, breakfasts and hours stay on the bill.
    const saved = rowOf(id)
    return {
      security_deposit: 0, created_at: '', expires_at: null,
      ...saved,
      id: 'draft-' + id, room_id: s.type === 'room' ? unit : undefined, venue_id: s.type === 'venue' ? unit : undefined,
      guest_name: guestName, guest_email: '', guest_phone: '', check_in: s.checkIn, check_out: s.checkOut,
      source: 'manual', status: 'confirmed', payment_records: saved?.payment_records || [], downpayment_paid: saved?.downpayment_paid || 0, balance_due: 0,
      // A short stay has no breakfast (the owner, 2026-10-24: "they won't need it").
      breakfast_included: !isShort && breakfast.includes(id),
      stay_hours: isShort ? hours : undefined,
      stay_half: isShort ? half : undefined,
      event_addons: Object.keys(ea).length > 0 ? ea : undefined,
      equipment_rentals: rentals,
      partner_deal_id: deal?.id, company_name: to?.name, contract_rate_override: rates[id] || deal?.contracted_rates[unit] || undefined,
      applied_discount: disc && disc.v > 0 && !to && (disc.pct || i === 0) ? { type: disc.pct ? 'percent' : 'flat', value: disc.v } : undefined,
    } as Booking
  }
  const drafts = list.map(([id, s], i) => draftOf(id, s, i))
  // Taken off, a room's money stays on the bill: shown on the first room, where saving puts it.
  const gone = (editing || []).filter(b => holdsMoney(b) && !list.some(([id]) => rowOf(id) === b))
  if (gone.length > 0 && drafts[0]) drafts[0] = withMoneyOf(drafts[0], gone)
  const statement = drafts.length > 0
    ? buildStatement({ primaryBooking: drafts[0], relatedBookings: drafts, rooms, venues, bookingsList: bookings,
        slipsByBooking: Object.fromEntries(list.map(([id]) => ['draft-' + id, slips[rowOf(id)?.id || ''] || []])) })
    : null
  const total = statement?.subTotal ?? 0
  // What the discount takes off, in pesos: the statement's own Discount rows.
  const discOff = -(statement?.lineItems.filter(i => i.band === 'discount').reduce((s, i) => s + i.amount, 0) ?? 0)
  const received = editing ? (statement?.payments || []).reduce((a, x) => a + x.amount, 0) : paid?.amount ?? 0
  const due = Math.max(0, total - received)
  const paidUp = received > 0 && due === 0
  const [paysOpen, setPaysOpen] = useState(false)

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
    if (d) {
      setTo({ name: d.name, dealId: d.id }); setPaid(null); setWriting(false)
      // An agency that always has breakfast turns every room's switch on; the desk can still
      // turn one off (Sebastian, 2026-10-25: four breakfast lines took too much space).
      if (d.breakfast_default === 'with' && !isShort) setBreakfast(list.filter(([, s]) => s.type === 'room').map(([id]) => id))
      return
    }
    const known = institutions.find(n => n.trim().toUpperCase() === name)
    setTo({ name: known || name }); setPaid(null); setWriting(false)
    // A name not in either list is kept as a new institution, as the form's list does.
    if (!known) insertInstitution(name).then(i => setInstitutions(l => [...l, i.name]))
      .catch(() => showToast(name + ' was not added to the list. It is still on this booking.', 'error'))
  }

  const others = editing ? bookings.filter(b => !editing.some(e => e.id === b.id)) : bookings
  // Free of other bookings, and of this bill's other line of the same room or venue.
  const free = (key: string, from: string, to: string) => {
    const id = unitOfLine(key)
    return (rooms.some(r => r.id === id)
      ? isRoomAvailable(id, from, to, others, undefined, isShort ? { stay_hours: hours, stay_half: half } : undefined)
      : isVenueRangeAvailable(id, from, to, others))
      && !list.some(([k, s]) => k !== key && unitOfLine(k) === id && s.checkIn < to && from < s.checkOut)
  }
  const countOf = (from: string, to: string) => Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000))
  const priceOf = (key: string) => {
    const id = unitOfLine(key)
    const r = rooms.find(x => x.id === id), v = venues.find(x => x.id === id)
    return deal?.contracted_rates[id] || (r ? getEffectiveNightlyPrice(r.base_price, r.promo_price) : v ? getEffectiveNightlyPrice(v.base_price, v.promo_price) : 0)
  }
  const kindsOf = (key: string) => {
    const venue = venues.find(v => v.id === unitOfLine(key))
    const types = venueTypes(venue)
    return venue && types.length > 0
      ? [{ key: '', label: venue.name.split(' ').pop() || venue.name, price: getEffectiveNightlyPrice(venue.base_price, venue.promo_price) },
        ...types.map(t => ({ key: t.key, label: t.label.startsWith(venue.name + ' ') ? t.label.slice(venue.name.length + 1) : t.label, price: Number(t.price) }))]
      : []
  }
  const lineOf = (id: string) => statement?.lineItems.find(i => i.key === 'draft-' + id + '-stay')
  // The first night a unit is taken in the given dates ("10/29"), or '' when it is free.
  const takenOn = (id: string, from: string, to: string) => {
    for (let d = from; d < to; d = nextDay(d)) if (!free(id, d, nextDay(d))) return Number(d.slice(5, 7)) + '/' + Number(d.slice(8))
    return ''
  }
  // A room swaps for a room and a venue for a venue; adding offers the rooms, then the venues.
  // Every one is listed in room order, a taken one too (Sebastian, 2026-10-25: "it should always show
  // ALL the rooms … they will just [change] the date if needed"): picking it opens its dates. Adding
  // lists the ones on the bill too, "On this bill", for the same one again on a later day (2026-10-25).
  const after = (id: string) => list.filter(([k]) => unitOfLine(k) === id).map(([, s]) => s.checkOut).sort().pop()
  const unitChoices = (swapOut?: string) => {
    const was = swapOut ? list.find(([id]) => id === swapOut)?.[1] : undefined
    const at = was || first
    const wasRate = swapOut ? lineOf(swapOut)?.price || 0 : 0
    const options: UnitOption[] = []
    if (!at) return options
    const all = [...rooms.map(r => ({ id: r.id, type: 'room' as const })), ...venues.map(v => ({ id: v.id, type: 'venue' as const }))]
      .filter(u => !(was && list.some(([id]) => unitOfLine(id) === u.id)) && (!was || u.type === was.type))
    for (const u of all) {
      const mine = was ? undefined : after(u.id)
      const ci = mine || at.checkIn, co = mine ? nextDay(mine) : was || u.type === 'room' ? at.checkOut : nextDay(at.checkIn)
      const rate = priceOf(u.id), count = countOf(ci, co)
      options.push({ id: u.id, label: unitName(u.id, { checkIn: ci, checkOut: co, type: u.type }), rate, count, diff: (rate - wasRate) * count, venue: u.type === 'venue', taken: takenOn(u.id + '~new', ci, co), mine: !!mine })
    }
    return options
  }
  // A unit on the bill whose dates are booked by someone else: it waits for new dates before it saves.
  const clash = list.some(([id, s]) => !free(id, s.checkIn, s.checkOut))
  const pickUnit = (id: string) => {
    if (!pop || !first) return
    const type: Sel['type'] = rooms.some(r => r.id === id) ? 'room' : 'venue'
    if (pop.kind === 'add') {
      // On the bill already: a line of its own, the day after its last one.
      const last = after(id), key = last ? id + '~' + randomUUID().slice(0, 8) : id
      setUnits(u => sortUnits([...u, [key, last ? { checkIn: last, checkOut: nextDay(last), type } : { checkIn: first.checkIn, checkOut: type === 'venue' ? nextDay(first.checkIn) : first.checkOut, type }]]))
      if (type === 'room' && !isShort && deal?.breakfast_default === 'with') setBreakfast(b => [...b, key])
      setAskIn(key); setPop(null); setUnitOff(null); setFresh(key)
      return
    } else {
      const out = pop.id
      // A swapped room takes its breakfast along; a new venue starts on its plain kind and price.
      setUnits(u => u.map(([x, s]): [string, Sel] => x === out ? [id, s] : [x, s]))
      setBreakfast(b => b.map(x => x === out ? id : x))
      setKinds(k => { const n = { ...k }; delete n[out]; return n })
      setRates(r => { const n = { ...r }; delete n[out]; return n })
      const s = list.find(([x]) => x === out)?.[1]
      if (s && !free(id, s.checkIn, s.checkOut)) setAskIn(id)
    }
    setPop(null); setUnitOff(null); setFresh(id)
  }
  const takeOff = (id: string, s: Sel) => {
    const saved = rowOf(id)
    setUnitOff({ label: unitName(id, s), money: saved && holdsMoney(saved) ? Number(saved.downpayment_paid || 0) : 0, units, breakfast, kinds, rates })
    setUnits(u => u.filter(([x]) => x !== id)); setBreakfast(b => b.filter(x => x !== id)); setPop(null)
  }
  const putBack = () => {
    if (!unitOff) return
    setUnits(unitOff.units); setBreakfast(unitOff.breakfast); setKinds(unitOff.kinds); setRates(unitOff.rates); setUnitOff(null)
  }
  const keepRate = (id: string, raw: string) => {
    setRateBox(null)
    const v = Number(raw.replace(/\D/g, ''))
    if (!v) return
    const kind = kindsOf(id).find(k => k.key === (kinds[id] || ''))
    // A short stay's own price is the room's board price for its hours.
    const room = isShort ? rooms.find(r => r.id === unitOfLine(id)) : undefined
    const hourly = hours === 3 ? room?.hour3_price : hours === 6 ? room?.hour6_price : hours === 12 ? room?.hour12_price : null
    const own = deal?.contracted_rates[unitOfLine(id)] || kind?.price || hourly || priceOf(id)
    setRates(r => { const n = { ...r }; if (v === own) delete n[id]; else n[id] = v; return n })
    setFresh(id)
  }

  const editingProp = editing
  // `live` is a correction being saved behind the bill: the rows as the cache holds them when the save runs.
  const handleBook = async (live?: { rows: Booking[]; active: Booking[]; all: Booking[] }) => {
    const editing = live?.rows ?? editingProp
    const ed = editing?.[0]
    const bookingsNow = live?.active ?? bookings
    if (!to && !guestName.trim()) { if (!live) want(nameBox.current); return }
    if (list.length === 0) { setError('Pick the room and the dates on the calendar first.'); return }
    setError(''); setSaving(true)
    const plan = ed ? ed.payment_plan || 'reservation' : !paid ? 'reservation' : paid.amount >= total ? 'full' : 'custom'
    const sum = (f: (b: Booking) => number) => (editing || []).reduce((a, b) => a + f(b), 0)
    const venueKit = editing?.find(b => b.venue_id && b.equipment_rentals)?.equipment_rentals
    const result = await submitBookingForm({
      unitSelections: Object.fromEntries(list),
      formRoomIds: new Set(list.filter(([, s]) => s.type === 'room').map(([id]) => id)),
      formVenueIds: new Set(list.filter(([, s]) => s.type === 'venue').map(([id]) => id)),
      rooms, venues, allBookings: live?.all ?? allBookings, partnerDeals,
      activeBookings: editing ? bookingsNow.filter(b => !editing.some(e => e.id === b.id)) : bookingsNow,
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
      formBreakfastRoomIds: isShort ? [] : breakfast, formCompanions: companions.filter(c => c.name.trim()),
      ...extrasOf(to ? NO_EXTRAS : extras),
      // What the bill does not show is sent back as saved, or the save would blank it.
      formChairs: venueKit?.chairCount || 0, formEventTable: venueKit?.tableCount || 0, formEventTent: venueKit?.tentCount || 0,
      formVenueExcessHours: ed?.venue_excess_hours || 0, formBlockNotes: ed?.notes || '', venueDayBlocks: ed?.venue_day_blocks || undefined,
      discountType: !disc || !disc.v || to ? 'none' : disc.pct ? 'percent' : 'flat', discountValue: disc?.v || 0,
      formVenueTypes: kinds,
      formPaymentMethod: ed ? ed.payment_method || '' : paid?.method || '', formPaymentReference: ed ? ed.payment_reference || '' : paid?.reference || '',
      formPaymentPlan: plan, formPaymentPurpose: paid?.purpose,
      formCharges: charges,
      formRates: rates,
      stay_hours: isShort ? hours : undefined,
      stay_half: isShort ? half : undefined,
      editingBookings: editing,
      // Each room keeps its own money; the balance is worked out again below.
      derivedPaymentStatus: ed ? ed.payment_status || 'unpaid' : 'unpaid',
      formDownpaymentPaid: sum(b => Number(b.downpayment_paid || 0)),
      formBalanceDue: ed ? sum(b => Number(b.balance_due || 0)) : null,
      formSecurityDeposit: ed ? sum(b => Number(b.security_deposit || 0)) : null,
      receivedAmount: paid?.amount || 0,
      createManualBooking, updateBooking, cancelBooking, deleteBooking,
    })
    if (!result.ok) {
      setSaving(false); setError(result.error)
      if (live) showToast('That change was not saved: ' + result.error, 'error')
      return
    }
    if (editing) {
      // The form keeps the balance it was handed; a charge taken off here has to come off
      // what is owed too, so each room is priced again: stay + food − money received.
      try {
        // A room taken off with money on it was kept as Cancelled by the save. Its money moves onto the
        // bill's first room ("Money stays on the bill", 2026-10-24), what the save did not already keep,
        // and the cancelled copy goes once the money has landed, or it would count twice.
        const left = editing.filter(b => holdsMoney(b) && !result.bookings.some(r => r.id === b.id))
        const saved = [...result.bookings]
        if (left.length > 0 && saved[0]) {
          const held = editing.reduce((a, b) => a + Number(b.downpayment_paid || 0), 0)
          const kept = saved.reduce((a, b) => a + Number(b.downpayment_paid || 0), 0)
          saved[0] = { ...withMoneyOf(saved[0], left), downpayment_paid: Number(saved[0].downpayment_paid || 0) + Math.max(0, held - kept) }
        }
        for (const [i, b] of saved.entries()) {
          const priced = recomputeBalance(b, { rooms, venues, tabTotal: await readBookingFoodTotal(b.id) })
          if (b !== result.bookings[i] || priced.balance_due !== b.balance_due || priced.payment_status !== b.payment_status) await updateBooking(priced)
        }
        for (const b of left) await deleteBooking(b.id)
      } catch {
        showToast('The changes are saved, but the balance was not worked out again. Open the booking and try again.', 'error')
      }
      setSaving(false); setError('')
      ids.current = result.bookings.map(b => b.id)
      // A line added again (`id~…`) takes the id of the row it was saved as, so the next save updates
      // that row instead of making another. The save goes rooms first, then venues, in the bill's order.
      const order = [...list.filter(([, s]) => s.type === 'room'), ...list.filter(([, s]) => s.type === 'venue')].map(([k]) => k)
      const renamed = new Map<string, string>()
      order.forEach((k, i) => { const row = result.bookings[i]; if (k.includes('~') && row && !k.endsWith('~' + row.id)) renamed.set(k, unitOfLine(k) + '~' + row.id) })
      if (renamed.size > 0) {
        const re = (k: string) => renamed.get(k) || k
        const reKeys = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [re(k), v]))
        // ponytail: the new keys read as a change and save the same bill once more; harmless.
        setUnits(u => u.map(([k, s]): [string, Sel] => [re(k), s])); setBreakfast(b => b.map(re)); setKinds(reKeys); setRates(reKeys)
      }
      onSaved?.(result.bookings)
      return
    }
    setSaving(false)
    if (preparedBy.trim()) rememberReceptionist(preparedBy)
    // Booked: its one bill opens, ready for the money (the one-bill mock, 2026-10-24).
    focusBookingAfterCreate(result.bookings[0]?.id)
    if (onBooked) onBooked(result.bookings); else onClose()
  }

  // **Saved as it is made** (the one-bill mock: "No Save button"). Every save and every payment
  // waits its turn, and each reads the rows from the cache when it runs, so a payment written
  // while a change is saving is not written over by it.
  // ponytail: one queue per open bill; two desks editing the same booking at once can still race.
  const qc = useQueryClient()
  const ids = useRef((editing || []).map(b => b.id))
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const chain = (job: () => Promise<unknown>) => (queue.current = queue.current.then(job).catch(() => {}))
  const liveRows = () => {
    const all = qc.getQueryData<Booking[]>(['bookings']) || allBookings
    const active = all.filter(b => b.status !== 'cancelled')
    const anchor = active.find(b => ids.current.includes(b.id))
    return { rows: anchor ? groupOf(anchor, active) : editing || [], active, all }
  }
  const sig = editing ? JSON.stringify([guestName, guestPhone, nationality, address, companions, hours, breakfast, extras, charges, kinds, disc, to, preparedBy, units, rates]) : ''
  const savedSig = useRef(sig)
  const latest = useRef(handleBook)
  useEffect(() => { latest.current = handleBook })
  const [mark, setMark] = useState<'saving' | 'saved' | null>(null)
  const save = () => {
    if (!editing || clash || sig === savedSig.current) return queue.current
    savedSig.current = sig
    setMark('saving')
    return chain(async () => { await settle(); await latest.current(liveRows()); setMark('saved') })
  }
  useEffect(() => {
    if (!editing || clash || sig === savedSig.current) return
    const t = setTimeout(() => void save(), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  // Money goes in behind whatever is still saving.
  const behind = (job: () => Promise<void> | void) => { void save(); void chain(async () => { await settle(); await job() }) }
  const close = () => { void save(); onClose() }
  const paperBox = useRef<HTMLDivElement>(null)

  const unitName = (key: string, s: Sel) => {
    const id = unitOfLine(key)
    return s.type === 'room'
      ? ['Room ' + (rooms.find(r => r.id === id)?.room_number ?? ''), rooms.find(r => r.id === id)?.name].filter(Boolean).join(' · ')
      : venues.find(v => v.id === id)?.name || id
  }

  const label = 'text-[10px] text-muted'
  const figure = 'font-mono text-[11.5px] font-bold text-ink-900'
  const LINE = 'w-full min-w-0 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 py-px text-ink-900 placeholder:text-paper-400 placeholder:font-medium focus:outline-none focus:border-solid focus:bg-gold-100 transition-colors'
  const info = LINE + ' text-[11px] font-semibold mt-1'
  // Each line keeps its own dates now, so the Stay block says the first day to the last.
  const span = first ? { checkIn: list.map(([, s]) => s.checkIn).sort()[0], checkOut: list.map(([, s]) => s.checkOut).sort().slice(-1)[0] } : null
  const nights = span ? Math.round((new Date(span.checkOut).getTime() - new Date(span.checkIn).getTime()) / 86400000) : 0
  const today = new Date()

  // Breakfast is one line with a switch for each room, an agency's bill too.
  const bfRooms = isShort ? [] : list.filter(([id, s]) => s.type === 'room' && rooms.some(r => r.id === unitOfLine(id)))
  const bfLines = statement?.lineItems.filter(i => /^draft-.+-breakfast$/.test(i.key)) || []
  const lastRoomKey = 'draft-' + list[list.length - 1]?.[0] + '-stay'
  const isOpen = (kind: NonNullable<typeof pop>['kind'], id = '') => pop?.kind === kind && pop.id === id
  const toggle = (kind: NonNullable<typeof pop>['kind'], id = '') => (e: React.MouseEvent<HTMLElement>) => {
    const at = e.currentTarget
    setPop(p => p && p.kind === kind && p.id === id ? null : { kind, id, at }); setRateBox(null)
  }
  const VAL = 'px-0.5 rounded-sm border-b-[1.5px] border-dashed border-gold-400 print:border-0 hover:bg-gold-100 aria-expanded:bg-gold-100 aria-expanded:border-solid active:scale-95 transition-[background-color,transform] cursor-pointer'
  const CHEV = 'print:hidden w-3 h-3 text-gold-600 transition-transform duration-300 group-aria-expanded:rotate-180'
  const BLANK = 'group w-full mt-1.5 mb-0.5 flex items-center gap-1.5 px-2 py-[5px] rounded-md border-[1.5px] border-dashed border-paper-200 text-[11px] font-bold text-gold-800 hover:border-gold-400 hover:bg-gold-100/40 aria-expanded:border-gold-400 aria-expanded:bg-gold-100 active:scale-[0.99] transition-[background-color,border-color,transform] cursor-pointer'
  const unRate = (id: string) => setRates(r => { const n = { ...r }; delete n[id]; return n })

  const renderLine = (it: StatementLineItem, cell: string): React.ReactNode | undefined => {
    // All the rooms' breakfasts are one line (Sebastian, 2026-10-24): every morning across them,
    // the first morning to the last; its name opens the rooms' switches.
    if (/^draft-.+-breakfast$/.test(it.key)) {
      if (it !== bfLines[0]) return null
      const on = bfRooms.filter(([id]) => breakfast.includes(id))
      const count = bfLines.reduce((a, i) => a + Number(i.qty), 0)
      const amount = bfLines.reduce((a, i) => a + i.amount, 0)
      return (
        <tr key={'bf-' + count + '-' + amount} className={fresh === 'bf' ? 'bill-ink' : undefined}>
          <td className={cell + ' pl-0 text-left whitespace-normal'}>
            <button type="button" data-bf onClick={toggle('bf')} aria-expanded={isOpen('bf')} className={VAL + ' group inline-flex items-center gap-1 -ml-0.5'}>
              Breakfast · {on.length > 1 ? 'Rooms ' : 'Room '}{[...new Set(on.map(([id]) => rooms.find(r => r.id === unitOfLine(id))?.room_number))].join(', ')}
              <ChevronDown aria-hidden="true" className={CHEV} />
            </button>
          </td>
          <td className={cell + ' text-right font-mono'}>{it.price ? money(it.price) : '—'}</td>
          <td className={cell + ' text-right font-mono'}>{shortDate(on.map(([, s]) => isShort ? s.checkIn : nextDay(s.checkIn)).sort()[0])}</td>
          <td className={cell + ' text-right font-mono'}>{shortDate(on.map(([, s]) => s.checkOut).sort().slice(-1)[0])}</td>
          <td className={cell + ' text-right font-mono'}>{count}</td>
          <td className={cell + ' text-right font-mono font-bold'}>{money(amount)}</td>
        </tr>
      )
    }
    // A room's price: tapped to type a new one, "custom ↺" back to its own. A short stay's line uses it too (2026-10-24).
    const rateCell = (id: string, name: string, it: StatementLineItem) => (
      <td className={cell + ' text-right font-mono'}>
        {rates[id] != null && rateBox !== id && (
          <button type="button" onClick={() => { unRate(id); setFresh(id) }} title="Back to its own price"
            className="print:hidden mr-1.5 px-1 py-px rounded bg-gold-100 text-gold-800 font-sans text-[9px] font-bold active:scale-90 transition-transform cursor-pointer bw-rise">custom ↺</button>
        )}
        {rateBox === id ? (
          <input autoFocus defaultValue={String(it.price)} inputMode="numeric" placeholder="950" aria-label={name + ' rate'}
            onFocus={e => e.currentTarget.select()} onBlur={e => keepRate(id, e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRateBox(null) }}
            className="w-16 bg-card border-0 border-b-[1.5px] border-ink-900 focus:border-gold-400 rounded-none px-0.5 text-right font-mono text-[11px] font-semibold text-ink-900 focus:outline-none bw-rise" />
        ) : (
          <button type="button" onClick={() => { setRateBox(id); setPop(null) }} className={VAL}>{money(it.price)}</button>
        )}
      </td>
    )
    if (isShort && it.key.endsWith('-stay')) {
      const id = list[0][0]
      return (
        <tr key={id + it.amount} className={fresh === id ? 'bill-ink' : undefined}>
          <td className={cell + ' pl-0 text-left whitespace-normal'}>{it.description}</td>
          {rateCell(id, it.description, it)}
          <td className={cell + ' text-right font-mono'}>{shortDate(it.checkIn)}</td>
          <td className={cell + ' text-right font-mono'}>{shortDate(it.checkOut)}</td>
          <td className={cell + ' text-right font-mono'}>{it.qty} hrs</td>
          <td className={cell + ' text-right font-mono font-bold'}>{money(it.amount)}</td>
        </tr>
      )
    }
    if (isShort || !it.key.endsWith('-stay')) return undefined
    const entry = list.find(([id]) => it.key === 'draft-' + id + '-stay')
    if (!entry) return undefined
    const [id, s] = entry
    const name = unitName(id, s)
    const kindList = kindsOf(id)
    return (
      <>
        {/* A line changed lands like ink, the same as a charge just written. */}
        <tr key={id + s.checkIn + s.checkOut + it.amount} className={fresh === id ? 'bill-ink' : undefined}>
          <td className={cell + ' pl-0 text-left whitespace-normal'}>
            <button type="button" onClick={toggle('swap', id)} aria-expanded={isOpen('swap', id)} className={VAL + ' group inline-flex items-center gap-1 -ml-0.5'}>
              {name}{deal?.contracted_rates[unitOfLine(id)] && !rates[id] ? ' · corporate' : ''}<ChevronDown aria-hidden="true" className={CHEV} />
            </button>
            {list.length > 1 && (
              <button type="button" onClick={() => takeOff(id, s)} aria-label={'Take ' + name + ' off the bill'}
                className="print:hidden -my-1 ml-0.5 p-1 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
            {/* Only the kind it is shows (the owner: "make it more contextual"); the others float under it. */}
            {kindList.length > 0 && (
              <button type="button" onClick={toggle('kind', id)} aria-expanded={isOpen('kind', id)} aria-label={name + ' type'}
                className="group ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-px rounded-md bg-paper-100 text-[10px] font-bold text-ink-700 hover:bg-gold-100 aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,transform] cursor-pointer">
                {kindList.find(k => k.key === (kinds[id] || ''))?.label}<ChevronDown aria-hidden="true" className={CHEV} />
              </button>
            )}
          </td>
          {rateCell(id, name, it)}
          <td className={cell + ' text-right font-mono'}>
            <button type="button" data-in={id} onClick={toggle('in', id)} aria-expanded={isOpen('in', id)} aria-label={name + ' check in'} className={VAL + (free(id, s.checkIn, s.checkOut) ? '' : ' !bg-gold-100 !text-gold-800 print:!bg-transparent')}>{shortDate(s.checkIn)}</button>
          </td>
          <td className={cell + ' text-right font-mono'}>
            <button type="button" onClick={toggle('out', id)} aria-expanded={isOpen('out', id)} aria-label={name + ' check out'} className={VAL}>{shortDate(s.checkOut)}</button>
          </td>
          <td className={cell + ' text-right font-mono'}>{it.qty}</td>
          <td className={cell + ' text-right font-mono font-bold'}>{money(it.amount)}</td>
        </tr>
        {it.key === lastRoomKey && (
          <>
            {unitOff && (
              <tr key={'off-' + unitOff.label}>
                <td colSpan={6} className="pt-1 text-[10.5px] font-semibold text-muted bw-rise">
                  {unitOff.label} taken off{unitOff.money > 0 && <> · the {money(unitOff.money)} paid stays on the bill</>} · <button type="button" onClick={putBack} className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
                </td>
              </tr>
            )}
            <tr data-screen className="print:hidden">
              <td colSpan={6} className="p-0">
                <button type="button" onClick={toggle('add')} aria-expanded={isOpen('add')} className={BLANK}><Plus aria-hidden="true" className="w-3.5 h-3.5" /> Add a room or venue</button>
              </td>
            </tr>
          </>
        )}
      </>
    )
  }

  // What floats over the bill: the free rooms, a venue's kinds, the breakfast switches or a month.
  const floating = () => {
    if (!pop || !sheetEl) return null
    const p = pop
    const s = list.find(([id]) => id === p.id)?.[1]
    const common = { sheet: sheetEl, onClose: () => setPop(null) }
    // The breakfast line is drawn anew when its first switch goes on: the list follows it there.
    const at = () => (p.kind === 'bf' ? sheet.current?.querySelector<HTMLElement>('[data-bf]') : null) || p.at
    if (p.kind === 'swap' || p.kind === 'add') {
      const c = unitChoices(p.kind === 'swap' ? p.id : undefined)
      return (
        <Floating key={p.kind + p.id} {...common} at={at} width={330} label={p.kind === 'add' ? 'Add a room or venue' : 'Swap ' + (s ? unitName(p.id, s) : '')}>
          <UnitList options={c} adding={p.kind === 'add'} onPick={pickUnit} />
        </Floating>
      )
    }
    if (p.kind === 'kind') return (
      <Floating key={p.kind + p.id} {...common} at={at} width={260} label="Type">
        <KindList kinds={kindsOf(p.id)} chosen={kinds[p.id] || ''}
          onPick={k => { setKinds(x => ({ ...x, [p.id]: k })); unRate(p.id); setFresh(p.id); setPop(null) }} />
      </Floating>
    )
    if (p.kind === 'bf') return (
      <Floating key={p.kind + p.id} {...common} at={at} width={320} label="Breakfast">
        <BreakfastList pricing={pricing} onPrice={setPricing}
          rows={bfRooms.map(([id, us]) => {
            const room = rooms.find(r => r.id === unitOfLine(id))!
            return { id, label: unitName(id, us), price: breakfastSellable(room) ? roomBreakfastPrice(room) : null, count: isShort ? 1 : countOf(us.checkIn, us.checkOut), on: breakfast.includes(id) }
          })}
          onToggle={id => {
            const next = breakfast.includes(id) ? breakfast.filter(x => x !== id) : [...breakfast, id]
            setBreakfast(next); setRemoved(null); setFresh('bf')
            // The last one switched off takes the line with it, so the list goes too.
            if (!bfRooms.some(([x]) => next.includes(x))) setPop(null)
          }}
          onPriced={(id, price) => {
            setPricing(null)
            updateRoomBreakfastPrice?.(unitOfLine(id), price)
              .catch(() => showToast('The breakfast price for Room ' + rooms.find(r => r.id === unitOfLine(id))?.room_number + ' was not saved. Try again.', 'error'))
            setBreakfast(b => [...b, id]); setRemoved(null); setFresh('bf')
          }} />
      </Floating>
    )
    if (!s) return null
    return (
      <Floating key={p.kind + p.id} {...common} at={at} right width={236} label={(p.kind === 'in' ? 'Check in for ' : 'Check out for ') + unitName(p.id, s)}>
        <MonthPick end={p.kind === 'in' ? 'in' : 'out'} checkIn={s.checkIn} checkOut={s.checkOut} free={(a, b) => free(p.id, a, b)}
          taken={free(p.id, s.checkIn, s.checkOut) ? '' : unitName(p.id, s).split(' · ')[0] + ' is taken on these dates'}
          onPick={(ci, co) => { setUnits(u => u.map(([x, y]): [string, Sel] => x === p.id ? [x, { ...y, checkIn: ci, checkOut: co }] : [x, y])); setFresh(p.id); setPop(null) }} />
      </Floating>
    )
  }
  const book = ed ? '' : to ? 'Agency pays' : !paid ? 'No deposit' : paidUp ? 'Paid in full' : money(paid.amount) + ' deposit'

  return createPortal(
    <div className="fixed inset-0 z-[60] p-3 sm:p-4 bg-slate-900/50 overflow-y-auto bw-dim">
      <div ref={el => { sheet.current = el; setSheetEl(el) }} className="relative bw-eject">
        {floating()}
        <StatementShell label={(ed ? 'Billing statement' : 'New booking') + (to ? ' · agency' : '')} invoiceNumber={ed?.invoice_number || 'numbered when booked'} onClose={ed ? close : onClose}
          status={mark && <span key={mark} aria-live="polite" className={'text-[11px] font-semibold bw-rise ' + (mark === 'saved' ? 'text-emerald-300' : 'text-white/60')}>{mark === 'saved' ? '✓ Saved' : 'Saving…'}</span>}
          onPrint={ed ? () => { void save().then(settle).then(printA5) } : undefined}
          email={ed ? { kind: 'statement', number: ed.invoice_number || '', guestName: ed.guest_name, bookingId: ed.id, to: guestEmailOf(ed) } : undefined}
          paper={ed ? () => paperBox.current?.querySelector<HTMLElement>('[data-sheet]') ?? null : undefined}>
          <BrandHeader dateIssued={today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}>
            <span className={label + ' row-start-1'}>Bill no.</span>
            {ed?.invoice_number
              ? <span className="row-start-1 font-mono text-[13px] font-bold text-ink-900">{ed.invoice_number}</span>
              : <span className="row-start-1 font-mono text-[13px] font-bold text-paper-400">{today.getFullYear()}{String(today.getMonth() + 1).padStart(2, '0')}-…</span>}
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
              {list.map(([id, s]) => (
                <p key={id} className="font-display text-[14.5px] font-bold text-ink-900 leading-tight">{unitName(id, s)}</p>
              ))}
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
                    <div><p className={label}>Check in</p><p className="text-[12.5px] font-bold text-ink-900 leading-tight">{fmtDay(span!.checkIn)}</p></div>
                    {isShort ? <span /> : <p className={label + ' font-bold pt-3.5'}>to</p>}
                    {!isShort && <div><p className={label}>Check out</p><p className="text-[12.5px] font-bold text-ink-900 leading-tight">{fmtDay(span!.checkOut)}</p></div>}
                  </div>
                </>
              )}
            </div>
          </div>

          {statement && (
            <StatementChargesTable items={statement.lineItems} onRemove={removeLine} isNew={() => false} renderLine={renderLine}>
              {bfRooms.length > 0 && bfLines.length === 0 && (
                <tr data-screen className="print:hidden">
                  <td colSpan={6} className="p-0">
                    <button type="button" onClick={toggle('bf')} aria-expanded={isOpen('bf')} className={BLANK}>
                      <Coffee aria-hidden="true" className="w-3.5 h-3.5 group-hover:[animation:bk-hop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]" /> Breakfast
                    </button>
                  </td>
                </tr>
              )}
              {removed && (
                <tr key={removed.label}>
                  <td colSpan={6} className="pt-1 text-[10.5px] font-semibold text-muted bw-rise">
                    {removed.label} taken off · <button type="button" onClick={undo} className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
                  </td>
                </tr>
              )}
              <AddCharge onCharge={addCharge} cols={6}
                // The form's room extras, a tap for each one more; an agency's stay has none.
                presets={firstRoomId && !to ? EXTRAS.map(x => ({ label: x.label, price: x.price, onPick: () => { setExtras(e => ({ ...e, [x.key]: e[x.key] + 1 })); setRemoved(null) } })) : undefined} />
            </StatementChargesTable>
          )}

          <div className="grid grid-cols-[1fr_236px] gap-6 items-start">
            <div />
            <div className="relative flex flex-col gap-0.5">
              {(!to || desk) && (
                <>
                  {!to && <div className="flex justify-between gap-2.5"><span className={label}>Sub-total</span><span className={figure}>{money(total + discOff)}</span></div>}
                  {to ? null : disc ? (
                    <DiscountBox disc={disc} onChange={setDisc} off={discOff} fold />
                  ) : (
                    <button type="button" onClick={() => setDisc({ pct: true, v: 0 })} className="self-start text-[10.5px] font-bold text-gold-800 hover:underline cursor-pointer">+ Discount</button>
                  )}
                  <p className={label}>Less: payments received</p>
                  {/* On the one bill each payment can be fixed where it stands, and its receipt printed.
                      Paid in full, they fold to one line (Sebastian, 2026-10-25: "I want B"). */}
                  {editing && desk && statement && statement.payments.length > 0 && (
                    <div className="border-t border-ink-200">
                      {paidUp && statement.payments.length > 1 && (
                        <button type="button" onClick={() => setPaysOpen(o => !o)} aria-expanded={paysOpen}
                          className="group w-full grid grid-cols-[minmax(0,1fr)_auto_12px] gap-x-1.5 items-center py-1.5 border-b border-ink-200 text-left hover:bg-paper-50 transition-colors cursor-pointer">
                          <span className="text-[12.5px] font-bold text-ink-900">{statement.payments.length} payments
                            <span className="ml-1 text-[11px] font-normal text-ink-700">{dayOf(statement.payments[0].paidAt)}{dayOf(statement.payments[0].paidAt) !== dayOf(statement.payments[statement.payments.length - 1].paidAt) && <> – {dayOf(statement.payments[statement.payments.length - 1].paidAt)}</>}</span>
                          </span>
                          <span className="font-mono text-[13px] font-bold text-ink-900">−{money(received)}</span>
                          <ChevronDown aria-hidden="true" className="w-3 h-3 text-gold-800 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
                        </button>
                      )}
                      {(!paidUp || statement.payments.length < 2 || paysOpen) && statement.payments.map((x, i) => (
                        <div key={x.key} className="bw-rise" style={{ '--i': i } as React.CSSProperties}>
                          <FixPayment p={x} sheet={sheetEl} onFix={patch => behind(() => desk.onFix(x.key, patch))} onReceipt={desk.onReceipt} />
                        </div>
                      ))}
                    </div>
                  )}
                  {editing && !desk && statement && statement.payments.length > 0 && (
                    <div className="border-t border-ink-200">
                      {statement.payments.map(x => (
                        <PayRow key={x.key} purpose={x.purpose || '—'} method={paymentMethodLabel(x.method)} amount={'−' + money(x.amount)} under={dayOf(x.paidAt)} />
                      ))}
                    </div>
                  )}
                  {paid && (
                    <div className="border-t border-ink-200 bill-ink">
                      <PayRow purpose={<>{paid.purpose}
                        <button type="button" onClick={() => setPaid(null)} aria-label={'Take the ' + paid.purpose + ' payment off'}
                          className="ml-0.5 p-0.5 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer"><X className="w-3 h-3" /></button></>}
                        method={paymentMethodLabel(paid.method)} amount={'−' + money(paid.amount)} under="Today" />
                    </div>
                  )}
                  {editing && desk && due > 0 && (
                    <WritePayment key={statement?.payments.length} open={writing} onOpen={o => { setWriting(o); if (o) void save() }} again={(statement?.payments.length || 0) > 0}
                      // Deposit only until money is in, and never on a short stay; Full pay is what is still owed.
                      fills={[...(statement?.payments.length || isShort ? [] : [{ label: 'Deposit', amount: Math.round(total / 2) }]), { label: 'Full pay', amount: due }]}
                      onPay={p => behind(() => desk.onPay(p))} />
                  )}
                  {/* One payment at booking — what the guest hands over now. */}
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
          {!ed && (
            <button type="button" onClick={() => { if (!saving) handleBook() }}
              className="w-full min-h-[54px] rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[16px] font-bold cursor-pointer active:scale-[0.98] transition-[background-color,transform] bw-shine">
              Book <span key={book} className="text-[13px] font-semibold opacity-75 inline-block bw-rise">· {book}</span>
            </button>
          )}
        </StatementShell>
      </div>
      {/* The paper copy, off screen: what Print and Email send — the saved bill, with its
          payment details, policies and signatures, and none of the boxes. */}
      {ed && createPortal(
        <div ref={paperBox} aria-hidden="true" className="bill-paper fixed top-0 left-[-10000px] w-[576px]">
          <PrintInvoiceModal booking={ed} rooms={rooms} venues={venues} bookingsList={bookings} onClose={() => {}} embedded />
        </div>,
        document.body,
      )}
    </div>,
    document.body,
  )
}

const extrasOf = (e: Extras) => ({
  formExtraFoam: e.extraFoamCount, formExtraPillow: e.extraPillowCount, formExtraBlanket: e.extraBlanketCount, formExtraTowel: e.extraTowelCount,
})

/** "+ Discount" opened: % or ₱, the sign on the side it is read (the mock: % after, ₱ before). */
/**
 * **How much it takes off is said in pesos** (Sebastian, 2026-10-24, task #11: "show how much was
 * discounted"): `off` stands beside the box as it is typed, so 10% reads as −₱220. With `fold`, a
 * box that is left folds into the bill's own line, `Less: discount 10% −₱220`, which is tapped to
 * change it.
 */
export function DiscountBox({ disc, onChange, off, fold = false }: { disc: Discount; onChange: (d: Discount | null) => void; off?: number; fold?: boolean }) {
  const [open, setOpen] = useState(!fold || !disc.v)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Change the discount"
        className="w-full -mx-0.5 px-0.5 flex justify-between items-baseline gap-2.5 rounded text-left hover:bg-gold-100 transition-colors cursor-pointer bw-rise">
        <span className="text-[10px] text-muted">Less: discount{disc.pct && <b className="ml-1 font-bold text-ink-900">{disc.v}%</b>}</span>
        <span className="font-mono text-[11.5px] font-bold text-danger-600">−₱{(off || 0).toLocaleString()}</span>
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1.5 my-0.5 bw-unfold"
      onBlur={e => { if (fold && disc.v && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
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
      {off !== undefined && (
        <span key={off} className="shrink-0 min-w-[52px] text-right font-mono text-[12px] font-bold text-danger-600 bw-rise">{off ? '−₱' + off.toLocaleString() : '—'}</span>
      )}
    </div>
  )
}
