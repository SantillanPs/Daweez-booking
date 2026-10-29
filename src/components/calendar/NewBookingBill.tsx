import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ChevronDown, Coffee, Plus, Tag, X } from 'lucide-react'
import { Booking, BillCharge, Companion, EquipmentRental, EventAddons, Room, Venue } from '../../types/booking'
import { buildStatement, StatementLineItem, shortDate } from '../../utils/statement'
import { dateToString, normalizeVenueId, randomUUID } from '../../utils/helpers'
import { recomputeBalance } from '../../utils/bookingBalance'
import { readBookingFoodTotal } from '../../utils/orderSlips'
import { focusBookingAfterCreate } from '../../utils/bookingFocus'
import { breakfastSellable, roomBreakfastPrice, stayMornings } from '../../utils/breakfast'
import { venueTypes } from '../../utils/venueTypes'
import { discountsOf } from '../../utils/discounts'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { getSlipsByBooking, OrderSlip } from '../../utils/orderSlips'
import { clearStayHours } from '../../utils/db'
import { groupOf, unitOfLine } from '../../utils/bookingGroup'
import { stayUnitsLabel } from '../../utils/roomNumbers'
import { guestEmailOf } from '../../utils/emailDocument'
import { lastReceptionist, rememberReceptionist, staffNamesOf } from '../../utils/receptionists'
import { getInstitutions, insertInstitution } from '../../utils/institutions'
import { StatementShell, BrandHeader, SectionName } from '../billing/StatementShell'
import { StatementChargesTable } from '../billing/StatementChargesTable'
import { Floating, UnitList, UnitOption, KindList, LengthList, BreakfastList, MonthPick, MorningPick } from './BillRoomLines'
import { isRoomAvailable, isVenueRangeAvailable } from '../../utils/availability'
import { venueHoursOf } from '../../utils/venueHours'
import { getRateConfig } from '../../utils/rateConfig'
import { withMoneyOf, holdsMoney } from '../../utils/roomTakenOff'
import { ADD, AddCharge, Gut, PayInput, WritePayment } from '../billing/BillDesk'
import { useLateFocus } from '../billing/want'
import type { PaymentPatch } from '../walk-in/bookingPayment'
import { FixPayment, PayRow } from '../billing/FixPayment'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { CancelledStamp } from '../billing/CancelledStamp'
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
const shortWay = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)
const dayOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const sortUnits = (l: [string, Sel][]) => [...l].sort((a, b) => (a[1].type === 'room' ? 0 : 1) - (b[1].type === 'room' ? 0 : 1))
const nextDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return dateToString(new Date(y, m - 1, d + 1)) }
// Long enough for the cache's change to reach the booking panel's own handlers.
const settle = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r)))
const fmtDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }

interface Paid { amount: number; method: string; reference: string; purpose: string }
/** Who the bill goes to instead of the guest: an agency (its deal) or an institution (a name). */
interface BillTo { name: string; dealId?: string }
export interface Discount { pct: boolean; v: number; note?: string }

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
export function NewBookingBill({ rooms, venues, bookings, allBookings, createManualBooking, updateBooking, cancelBooking, deleteBooking, initialSelections, initialStayHours, initialStayHalf, editing, desk, mark: tapped, onSaved, onBooked, onBooking, onClose }: {
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
    onReceipt: (receipt: string, start?: 'print' | 'email') => void
    onPay: (p: PayInput) => Promise<void> | void
    onFix: (key: string, patch: PaymentPatch) => Promise<void> | void
  }
  /** The receipt number of the payment the desk tapped to get here (Cash Flow): it is ringed. */
  mark?: string
  /** The rows as saved, after each save of a correction (a swapped room is a new row). */
  onSaved?: (rows: Booking[]) => void
  /** A new booking was made: the calendar opens its one bill. */
  onBooked?: (rows: Booking[]) => void
  /** Opened in Cash Flow: the top bar's Booking takes the desk to it on the calendar. */
  onBooking?: () => void
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
  // A day can be turned into hours on the bill, and back (Sebastian, 2026-10-27: "what if I made a
  // mistake here and instead of booking 1 day, it's supposed to be just 6 hours"; the "Day or Hours" mock).
  const [short, setShort] = useState(!!(initialStayHours || ed?.stay_hours))
  const [half, setHalf] = useState<0 | 1>(initialStayHalf ?? ed?.stay_half ?? 1)
  const [breakfast, setBreakfast] = useState<string[]>(() => (editing || []).filter(b => b.room_id && b.breakfast_included).map(keyOf))
  // The mornings a room's breakfast is for, when the desk changed its dates on the bill
  // (Sebastian, 2026-10-29). A room not here has breakfast every morning of its stay.
  const [bfDays, setBfDays] = useState<Record<string, string[]>>(() => Object.fromEntries((editing || []).filter(b => b.room_id && b.breakfast_days?.length).map(b => [keyOf(b), b.breakfast_days!])))
  const [extras, setExtras] = useState<Extras>(() => {
    const r = editing?.find(b => b.room_id && b.equipment_rentals)?.equipment_rentals
    return r ? { extraFoamCount: r.extraFoamCount || 0, extraPillowCount: r.extraPillowCount || 0, extraBlanketCount: r.extraBlanketCount || 0, extraTowelCount: r.extraTowelCount || 0 } : NO_EXTRAS
  })
  // Every charge of the booking, wherever it was written — saved back onto the first unit.
  const [charges, setCharges] = useState<BillCharge[]>(() => (editing || []).flatMap(b => b.event_addons?.charges || []))
  const [kinds, setKinds] = useState<Record<string, string>>(() =>
    Object.fromEntries((editing || []).filter(b => b.venue_id && b.event_addons?.venue_type).map(b => [keyOf(b), b.event_addons!.venue_type!])))
  // As the form reads it back: a flat amount is what the rooms' shares add up to. Every room
  // holds the bill's list in the same order, so a place in it is one discount (2026-10-29).
  const [discs, setDiscs] = useState<Discount[]>(() => {
    const lists = (editing || []).map(b => discountsOf(b.applied_discount))
    const longest = lists.reduce((a, l) => (l.length > a.length ? l : a), [] as ReturnType<typeof discountsOf>)
    return longest.map((d, i) => ({
      pct: d.type === 'percent', note: d.note || '',
      v: d.type === 'percent' ? Number(d.value) || 0 : lists.reduce((a, l) => a + (l[i]?.type === 'flat' ? Number(l[i].value) || 0 : 0), 0),
    })).filter(d => d.v > 0)
  })
  const given = discs.filter(d => d.v > 0)
  const [removed, setRemoved] = useState<{ label: string; breakfast: string[]; extras: Extras; charges: BillCharge[]; discs: Discount[] } | null>(null)
  const [to, setTo] = useState<BillTo | null>(() =>
    ed?.partner_deal_id || ed?.company_name ? { name: ed.company_name || '', dealId: ed.partner_deal_id || undefined }
      : ed?.institution ? { name: ed.institution } : null)
  const [institutions, setInstitutions] = useState<string[]>([])
  const [paid, setPaid] = useState<Paid | null>(null)
  const [writing, setWriting] = useState(false)
  const [preparedBy, setPreparedBy] = useState(() => ed ? ed.prepared_by || '' : lastReceptionist())
  const [staffNames, setStaffNames] = useState(() => staffNamesOf(bookings))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const nameBox = useRef<HTMLInputElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  // The lists float inside the bill's own sheet, so they are drawn once it is there. One ref for
  // the life of the bill: a new one each render set the sheet again and drew the bill twice a key.
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null)
  const sheetRef = useCallback((el: HTMLDivElement | null) => { sheet.current = el; setSheetEl(el) }, [])
  // **Rooms on the bill** (the mock, Sebastian, 2026-10-24): the rooms and venues are the bill's own
  // lines, each with its own dates and rate, swapped, added or taken off right here.
  const [units, setUnits] = useState<[string, Sel][]>(() => sortUnits(editing
    ? editing.map((b): [string, Sel] => [keyOf(b), { checkIn: b.check_in, checkOut: b.check_out, type: b.room_id ? 'room' : 'venue' }])
    : Object.entries(initialSelections || {})))
  // A rate typed on the line; an agency's own rate is not one.
  const [rates, setRates] = useState<Record<string, number>>(() => Object.fromEntries((editing || [])
    .filter(b => b.contract_rate_override != null && !b.partner_deal_id).map(b => [keyOf(b), Number(b.contract_rate_override)])))
  // Everything tapped on the bill opens in one floating box (Sebastian, 2026-10-27, the "Bill pop-ups" mock);
  // `v` is the rate it opens on.
  const [pop, setPop] = useState<{ kind: 'swap' | 'add' | 'kind' | 'len' | 'bf' | 'bfFrom' | 'bfTo' | 'in' | 'out' | 'rate' | 'disc' | 'staff' | 'to'; id: string; at: HTMLElement; v?: number } | null>(null)
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

  // A venue's hours are a short stay too: before, the bill left them off, and saving a venue's hours dropped them.
  const isShort = short && !!units[0]
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
      breakfast_days: bfDays[id] || [],
      stay_hours: isShort ? hours : undefined,
      stay_half: isShort ? half : undefined,
      event_addons: Object.keys(ea).length > 0 ? ea : undefined,
      equipment_rentals: rentals,
      partner_deal_id: deal?.id, company_name: to?.name, contract_rate_override: rates[id] || deal?.contracted_rates[unit] || undefined,
      // Every room holds the whole list, so a discount keeps its place; a flat amount counts once, on the first.
      applied_discount: given.length > 0 && !to ? discs.map(d => ({ type: d.pct ? 'percent' as const : 'flat' as const, value: d.pct || i === 0 ? d.v : 0, note: d.note })) : undefined,
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
  // …and what each one takes off, by its place in the list.
  const offOf = (slot: number) => -(statement?.lineItems.filter(i => i.band === 'discount' && (i.slot ?? 0) === slot).reduce((s, i) => s + i.amount, 0) ?? 0)
  const received = editing ? (statement?.payments || []).reduce((a, x) => a + x.amount, 0) : paid?.amount ?? 0
  const due = Math.max(0, total - received)
  const paidUp = received > 0 && due === 0
  // Folded payments open by themselves when one of them is the payment that was tapped.
  const [paysOpen, setPaysOpen] = useState(!!tapped)
  const [discOpen, setDiscOpen] = useState(false)
  // Counts the coupons put away with something on them, so the discount line flashes as it takes each in.
  const [landed, setLanded] = useState(0)
  const markSeen = useRef(false)
  const pays = editing ? statement?.payments || [] : []
  const payCount = editing ? pays.length : paid ? 1 : 0
  // The pinned money slip steps aside while the bill's own totals are in sight.
  const scroller = useRef<HTMLDivElement>(null)
  const totalsBox = useRef<HTMLDivElement>(null)
  const [totalsSeen, setTotalsSeen] = useState(false)
  useEffect(() => {
    const el = totalsBox.current, root = scroller.current
    if (!el || !root) return
    const io = new IntersectionObserver(([e]) => setTotalsSeen(e.isIntersecting), { root, threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const snapshot = (label: string) => setRemoved({ label, breakfast, extras, charges, discs })
  const unitOf = (key: string) => list.find(([id]) => key.startsWith('draft-' + id + '-'))?.[0]
  const removeLine = (line: StatementLineItem) => {
    const id = unitOf(line.key), r = line.remove
    if (!id || !r) return
    snapshot(line.description)
    if ('breakfast_included' in r) setBreakfast(b => b.filter(x => x !== id))
    if (r.equipment_rentals) setExtras(e => { const n = { ...e }; EXTRAS.forEach(x => { n[x.key] = Number(r.equipment_rentals![x.key] || 0) }); return n })
    if (r.event_addons) setCharges(r.event_addons.charges || [])
    if (r.applied_discount) setDiscs(ds => ds.filter((_, k) => k !== line.slot))
  }
  const undo = () => { if (!removed) return; setBreakfast(removed.breakfast); setExtras(removed.extras); setCharges(removed.charges); setDiscs(removed.discs); setRemoved(null) }
  const addCharge = (name: string, amount: number) => {
    if (!first) return
    setCharges(c => [...c, { id: randomUUID(), name, amount, date: first.checkIn }])
    setRemoved(null)
  }

  const pickTo = (raw: string) => {
    const name = raw.trim().toUpperCase()
    setPop(null)
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
      : isVenueRangeAvailable(id, from, to, others, undefined, isShort ? { stay_hours: hours, stay_half: half } : undefined))
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
      setBfDays(d => { if (!d[out]) return d; const n = { ...d, [id]: d[out] }; delete n[out]; return n })
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
  // How long the one unit on the bill can be: a day (a room's night), or the hours it is sold for.
  const lengthsOf = (key: string) => {
    const id = unitOfLine(key)
    const room = rooms.find(r => r.id === id), venue = venues.find(v => v.id === id)
    if (room) return [{ h: 0, label: '1 night', price: priceOf(key) },
      ...HOURS.map(h => ({ h, label: h + ' hrs', price: (h === 3 ? room.hour3_price : h === 6 ? room.hour6_price : h === 12 ? room.hour12_price : null) || priceOf(key) }))]
    const hourly = venueHoursOf(venue, getRateConfig())
    return hourly.length === 0 ? [] : [{ h: 0, label: '1 day', price: kindsOf(key).find(k => k.key === (kinds[key] || ''))?.price || priceOf(key) },
      ...hourly.map(o => ({ h: o.hours, label: o.hours + ' hrs' + (o.aircon ? ' · aircon' : ''), price: o.price }))]
  }
  // Whether these hours fit in that half of the day, beside the other bookings.
  const fits = (key: string, h: number, hf: 0 | 1) => {
    const id = unitOfLine(key), ci = units[0]?.[1].checkIn
    if (!ci) return false
    const facts = { stay_hours: h, stay_half: hf }
    return rooms.some(r => r.id === id) ? isRoomAvailable(id, ci, nextDay(ci), others, undefined, facts) : isVenueRangeAvailable(id, ci, nextDay(ci), others, undefined, facts)
  }
  const pickLength = (key: string, h: number) => {
    unRate(key); setFresh(key)
    if (!h) { setShort(false); setPop(null); return }
    // Hours are one day: the check-out comes back to the day after, and the half is one that is free.
    // The box stays open on the Morning / Afternoon under them.
    setUnits(u => u.map(([x, y], i): [string, Sel] => i === 0 ? [x, { ...y, checkOut: nextDay(y.checkIn) }] : [x, y]))
    setShort(true); setHours(h); setHalf(fits(key, h, half) ? half : half ? 0 : 1)
  }
  const keepRate = (id: string, raw: string) => {
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
      // A cancelled bill stays cancelled while it is worked on: saving it once brought the booking back.
      bookingStatus: ed?.status === 'cancelled' ? 'cancelled' : to || (ed && ed.status !== 'pending') ? 'confirmed' : 'pending',
      formAgreedDeposit: ed ? ed.agreed_deposit ?? 0 : paid?.amount || 0,
      formGuestName: guestName.trim(), formGuestEmail: ed?.guest_email || deal?.email || '', formGuestPhone: guestPhone.trim(),
      formGuestGender: ed?.guest_gender || '', formGuestNationality: nationality.trim(), formGuestAddress: address.trim(), formBirthdate: ed?.birthdate || '',
      formPreparedBy: preparedBy.trim(),
      formCompanyName: to?.name || '', formInstitution: to && !to.dealId ? to.name : ed?.institution || '',
      formVehiclePlate: ed?.vehicle_plate || deal?.vehicle_plate || '', formInvoiceNumber: ed?.invoice_number || '', formSource: ed?.source || 'manual',
      formBreakfastRoomIds: isShort ? [] : breakfast, formBreakfastDays: bfDays, formCompanions: companions.filter(c => c.name.trim()),
      ...extrasOf(to ? NO_EXTRAS : extras),
      // What the bill does not show is sent back as saved, or the save would blank it.
      formChairs: venueKit?.chairCount || 0, formEventTable: venueKit?.tableCount || 0, formEventTent: venueKit?.tentCount || 0,
      formVenueExcessHours: ed?.venue_excess_hours || 0, formBlockNotes: ed?.notes || '', venueDayBlocks: ed?.venue_day_blocks || undefined,
      discounts: to ? [] : given.map(d => ({ type: d.pct ? 'percent' as const : 'flat' as const, value: d.v, note: d.note?.trim() || undefined })),
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
        // Hours turned back into a day: `update_booking` keeps hours it is sent none of, so they come off here.
        for (const [i, b] of saved.entries()) if (!isShort && b.stay_hours) { await clearStayHours(b.id); saved[i] = { ...b, stay_hours: undefined, stay_half: undefined } }
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
        setUnits(u => u.map(([k, s]): [string, Sel] => [re(k), s])); setBreakfast(b => b.map(re)); setBfDays(reKeys); setKinds(reKeys); setRates(reKeys)
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
  const sig = editing ? JSON.stringify([guestName, guestPhone, nationality, address, companions, short, hours, half, breakfast, bfDays, extras, charges, kinds, discs, to, preparedBy, units, rates]) : ''
  const savedSig = useRef(sig)
  const latest = useRef(handleBook)
  useEffect(() => { latest.current = handleBook })
  const [mark, setMark] = useState<'saving' | 'saved' | null>(null)
  // What the top bar's "✓ Saved" stands for: a change made after it hides it until it is saved too.
  const [markSig, setMarkSig] = useState(sig)
  const save = () => {
    if (!editing || clash || sig === savedSig.current) return queue.current
    savedSig.current = sig
    setMark('saving'); setMarkSig(sig)
    return chain(async () => { await settle(); await latest.current(liveRows()); setMark('saved') })
  }
  // Saved 5 seconds after the first change, or as the bill closes, whichever comes first (Sebastian,
  // 2026-10-30: "The billing should save after it closes or 5 seconds after a staff is changing
  // something"). Counted from the first change, so steady typing never keeps putting it off.
  const saveNow = useRef(save)
  useEffect(() => { saveNow.current = save })
  const wait = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!editing || clash || sig === savedSig.current || wait.current) return
    wait.current = setTimeout(() => { wait.current = undefined; void saveNow.current() }, 5000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  // However the bill goes away (closed, or the panel's Booking), what is still waiting is saved.
  useEffect(() => () => { clearTimeout(wait.current); void saveNow.current() }, [])
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
  const bfFrom = bfLines.map(i => i.checkIn || '').filter(Boolean).sort()[0] || ''
  const bfTo = bfLines.map(i => i.checkOut || '').sort().slice(-1)[0] || ''
  // Every room on the breakfast line takes the mornings from the first to the last that fall in its
  // own stay. All of them is no choice at all, so a stay made longer later has breakfast every morning.
  // A room left with none has its breakfast switched off.
  const pickMornings = (from: string, last: string) => {
    const on = bfRooms.filter(([id]) => breakfast.includes(id))
    const days: Record<string, string[]> = { ...bfDays }
    const off: string[] = []
    on.forEach(([id, s]) => {
      const all = stayMornings(s.checkIn, s.checkOut)
      const mine = all.filter(d => d >= from && d <= last)
      if (mine.length === 0) { off.push(id); delete days[id] } else if (mine.length === all.length) delete days[id]
      else days[id] = mine
    })
    setBfDays(days)
    if (off.length > 0) setBreakfast(b => b.filter(x => !off.includes(x)))
    setRemoved(null); setFresh('bf'); setPop(null)
  }
  const lastRoomKey = 'draft-' + list[list.length - 1]?.[0] + '-stay'
  const isOpen = (kind: NonNullable<typeof pop>['kind'], id = '') => pop?.kind === kind && pop.id === id
  const toggle = (kind: NonNullable<typeof pop>['kind'], id = '') => (e: React.MouseEvent<HTMLElement>) => {
    const at = e.currentTarget
    setPop(p => p && p.kind === kind && p.id === id ? null : { kind, id, at })
  }
  const VAL = 'px-0.5 rounded-none border-b-[1.5px] border-dashed border-gold-400 print:border-0 hover:bg-gold-100 aria-expanded:bg-gold-100 aria-expanded:border-solid active:scale-95 transition-[background-color,transform] cursor-pointer'
  const CHEV = 'print:hidden w-3 h-3 text-gold-800 transition-transform duration-300 group-aria-expanded:rotate-180'
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
          {/* The first and the last morning can be changed (Sebastian, 2026-10-29); the count and the money follow. */}
          <td className={cell + ' text-right font-mono'}>
            <button type="button" data-bf-from onClick={toggle('bfFrom')} aria-expanded={isOpen('bfFrom')} aria-label="First breakfast" className={VAL}>{shortDate(bfFrom)}</button>
          </td>
          <td className={cell + ' text-right font-mono'}>
            <button type="button" data-bf-to onClick={toggle('bfTo')} aria-expanded={isOpen('bfTo')} aria-label="Last breakfast" className={VAL}>{shortDate(bfTo)}</button>
          </td>
          <td className={cell + ' text-right font-mono'}>{count}</td>
          <td className={cell + ' text-right font-mono font-bold'}>{money(amount)}</td>
        </tr>
      )
    }
    // The × slides its room's line away first, then takes it off (the snappy mock, 2026-10-30).
    const slideOff = (x: HTMLElement, go: () => void) => {
      const tr = x.closest('tr')
      if (!tr || matchMedia('(prefers-reduced-motion: reduce)').matches) return go()
      tr.classList.add('bill-going'); setTimeout(go, 160)
    }
    // How long it is: on a bill of one room or venue it is a tap that turns a day into hours and back.
    const lenCell = (id: string, words: React.ReactNode) => (
      <td className={cell + ' text-right font-mono'}>
        {list.length === 1 && lengthsOf(id).length > 1
          ? <button type="button" data-len onClick={toggle('len', id)} aria-expanded={isOpen('len', id)} aria-label="How long" className={VAL}>{words}</button>
          : words}
      </td>
    )
    // A room's price: tapped, a box floats under it to type a new one or go back to its own. A short stay's line uses it too (2026-10-24).
    const rateCell = (id: string, name: string, it: StatementLineItem) => (
      <td className={cell + ' text-right font-mono'}>
        {rates[id] != null && <span className="print:hidden mr-1 font-sans text-[9px] font-bold text-gold-800 bw-rise">custom</span>}
        <button type="button" aria-label={name + ' rate'} aria-expanded={isOpen('rate', id)} className={VAL}
          onClick={e => { const at = e.currentTarget; setPop(p => p?.kind === 'rate' && p.id === id ? null : { kind: 'rate', id, at, v: it.price }) }}>{money(it.price)}</button>
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
          {lenCell(id, hours + ' hrs')}
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
        <tr key={id + s.checkIn + s.checkOut + it.amount} className={'group/row' + (fresh === id ? ' bill-ink' : '')}>
          <td className={cell + ' pl-0 text-left whitespace-normal'}>
            <button type="button" onClick={toggle('swap', id)} aria-expanded={isOpen('swap', id)} className={VAL + ' group inline-flex items-center gap-1 -ml-0.5'}>
              {name}{deal?.contracted_rates[unitOfLine(id)] && !rates[id] ? ' · corporate' : ''}<ChevronDown aria-hidden="true" className={CHEV} />
            </button>
            {list.length > 1 && (
              <button type="button" onClick={e => slideOff(e.currentTarget, () => takeOff(id, s))} aria-label={'Take ' + name + ' off the bill'}
                className="print:hidden -my-1 ml-0.5 p-1 align-middle rounded text-muted opacity-50 mouse:opacity-0 mouse:group-hover/row:opacity-50 focus-visible:!opacity-100 hover:!opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
            {/* Only the kind it is shows (the owner: "make it more contextual"); the others float under it. */}
            {kindList.length > 0 && (
              <button type="button" onClick={toggle('kind', id)} aria-expanded={isOpen('kind', id)} aria-label={name + ' type'}
                className="group ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-px rounded-[3px] shadow-[inset_0_0_0_1px_#E5E5E5] text-[10px] font-bold text-ink-700 hover:bg-gold-100 aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,transform] cursor-pointer">
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
          {lenCell(id, it.qty)}
          <td className={cell + ' text-right font-mono font-bold'}><span className={fresh === id ? 'bill-roll' : undefined}>{money(it.amount)}</span></td>
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
    // The breakfast line is drawn anew when its first switch goes on, and the stay's line when its length
    // changes: the box follows it there.
    const at = () => (p.kind === 'bf' || p.kind === 'len' ? sheet.current?.querySelector<HTMLElement>(p.kind === 'bf' ? '[data-bf]' : '[data-len]') : null) || p.at
    if (p.kind === 'swap' || p.kind === 'add') {
      const c = unitChoices(p.kind === 'swap' ? p.id : undefined)
      return (
        <Floating key={p.kind + p.id} {...common} at={at} label={p.kind === 'add' ? 'Add a room or venue' : 'Swap ' + (s ? unitName(p.id, s) : '')}>
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
    if (p.kind === 'len') return (
      <Floating key={p.kind + p.id} {...common} at={at} right label="How long">
        <LengthList lengths={lengthsOf(p.id)} chosen={isShort ? hours : 0} half={half}
          fits={(h, hf) => fits(p.id, h, hf)} onPick={h => pickLength(p.id, h)}
          onHalf={hf => { setHalf(hf); setFresh(p.id); setPop(null) }} />
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
    if (p.kind === 'bfFrom' || p.kind === 'bfTo') return (
      <Floating key={p.kind} {...common} at={() => sheet.current?.querySelector<HTMLElement>(p.kind === 'bfFrom' ? '[data-bf-from]' : '[data-bf-to]') || p.at} right width={236} label={p.kind === 'bfFrom' ? 'First breakfast' : 'Last breakfast'}>
        <MorningPick end={p.kind === 'bfFrom' ? 'from' : 'to'} from={bfFrom} to={bfTo}
          mornings={[...new Set(bfRooms.filter(([id]) => breakfast.includes(id)).flatMap(([, s]) => stayMornings(s.checkIn, s.checkOut)))].sort()}
          onPick={pickMornings} />
      </Floating>
    )
    if (p.kind === 'rate') return (
      <Floating key={p.kind + p.id} {...common} at={at} right label={(s ? unitName(p.id, s) : '') + ' rate'}>
        <TypeIn money value={p.v ? p.v.toLocaleString() : ''} placeholder="950" label="Rate" onSave={v => { keepRate(p.id, v); setPop(null) }}>
          {rates[p.id] != null && <button type="button" onClick={() => { unRate(p.id); setFresh(p.id); setPop(null) }} className={QUIET}>Back to its own price</button>}
        </TypeIn>
      </Floating>
    )
    if (p.kind === 'disc') {
      const i = Number(p.id)
      const d = discs[i] || { pct: true, v: 0, note: '' }
      const done = () => { setPop(null); if (d.v > 0) setLanded(n => n + 1); setDiscs(ds => ds.filter(x => x.v > 0)) }
      return (
        <Floating key={p.kind + p.id} at={at} sheet={sheetEl} right label="A discount" onClose={done}>
          <DiscountPop disc={d} off={offOf(i)} onChange={n => setDiscs(ds => { const c = [...ds]; c[i] = n; return c })} onDone={done}
            onNone={d.v > 0 ? () => { setPop(null); setDiscs(ds => ds.filter((x, k) => k !== i && x.v > 0)) } : undefined} />
        </Floating>
      )
    }
    if (p.kind === 'staff') return (
      <Floating key={p.kind} {...common} at={at} label="Receptionist">
        <TypeIn upper value="" placeholder="NAME · ANNA" label="Receptionist's name"
          onSave={raw => { const v = raw.trim().toUpperCase(); if (v) { setStaffNames(ns => ns.includes(v) ? ns : [...ns, v]); setPreparedBy(v) } setPop(null) }} />
      </Floating>
    )
    if (p.kind === 'to') return (
      <Floating key={p.kind} {...common} at={at} label="Agency or institution">
        <BillToList agencies={partnerDeals.map(d => d.name)} institutions={institutions} chosen={to?.name || ''} onPick={pickTo}
          onNone={to ? () => { setTo(null); setPop(null) } : undefined} />
      </Floating>
    )
    if (!s) return null
    return (
      <Floating key={p.kind + p.id} {...common} at={at} right width={236} label={(p.kind === 'in' ? 'Check in for ' : 'Check out for ') + unitName(p.id, s)}>
        <MonthPick end={p.kind === 'in' ? 'in' : 'out'} checkIn={s.checkIn} checkOut={s.checkOut} free={(a, b) => free(p.id, a, b)}
          taken={free(p.id, s.checkIn, s.checkOut) ? '' : unitName(p.id, s).split(' · ')[0] + ' is taken on these dates'}
          onPick={(ci, co) => {
            setUnits(u => u.map(([x, y]): [string, Sel] => x === p.id ? [x, { ...y, checkIn: ci, checkOut: co }] : [x, y]))
            // New dates are a new stay: its breakfast is every morning again.
            setBfDays(d => { if (!d[p.id]) return d; const n = { ...d }; delete n[p.id]; return n })
            setFresh(p.id); setPop(null)
          }} />
      </Floating>
    )
  }
  // "+ Discount" in the margin: a blank one on the end of the list, its coupon open under the line.
  // Pressed again while its coupon is open, it puts the coupon away (Sebastian, 2026-10-29: "pressing
  // discount twice doesn't close the discount").
  const addDisc = (e: React.MouseEvent<HTMLElement>) => {
    if (pop?.kind === 'disc') { setPop(null); if (discs.some((d, k) => k >= given.length && d.v > 0)) setLanded(n => n + 1); setDiscs(ds => ds.filter(d => d.v > 0)); return }
    const at = e.currentTarget.parentElement as HTMLElement
    setDiscs(ds => [...ds.filter(d => d.v > 0), { pct: true, v: 0, note: '' }])
    setDiscOpen(true)
    setPop({ kind: 'disc', id: String(given.length), at })
  }
  // The paper copy follows the saved booking, not each key typed: drawn again only once a change
  // is saved (typing on the bill was slow, 2026-10-29).
  const paperCopy = useMemo(() => ed && <PrintInvoiceModal booking={ed} rooms={rooms} venues={venues} bookingsList={bookings} onClose={() => {}} embedded />, [ed, rooms, venues, bookings])
  const book = ed ? '' : to ? 'Agency pays' : !paid ? 'No deposit' : paidUp ? 'Paid in full' : money(paid.amount) + ' deposit'

  return createPortal(
    <div ref={scroller} className="fixed inset-0 z-[60] p-3 sm:p-4 bg-slate-900/50 overflow-y-auto bw-dim">
      <div ref={sheetRef} className="relative bw-eject bill-snap">
        {floating()}
        <StatementShell label={(ed ? 'Billing statement' : 'New booking') + (to ? ' · agency' : '')} invoiceNumber={ed?.invoice_number || 'numbered when booked'} onClose={ed ? close : onClose}
          onBooking={ed && onBooking ? () => { void save(); onBooking() } : undefined}
          status={mark && (mark === 'saving' || sig === markSig) && <span key={mark} aria-live="polite" className={'text-[11px] font-semibold bw-rise ' + (mark === 'saved' ? 'text-emerald-300' : 'text-white/60')}>{mark === 'saved' ? '✓ Saved' : 'Saving…'}</span>}
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
                  <button type="button" onClick={toggle('to')} aria-expanded={isOpen('to')} aria-label={'Billed to ' + to.name + ', change'}
                    className={VAL + ' group inline-flex items-center gap-1.5 -ml-0.5 font-display text-[14.5px] font-bold text-ink-900 leading-tight text-left'}>
                    {to.dealId && <Building2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />}{to.name}<ChevronDown aria-hidden="true" className={CHEV} />
                  </button>
                  <span className={label + ' block'}>{to.dealId ? 'c/o' : 'Institution'}</span>
                </div>
              ) : (
                <button type="button" onClick={toggle('to')} aria-expanded={isOpen('to')} className="mb-0.5 inline-flex items-center gap-1 px-0.5 -ml-0.5 rounded text-[10.5px] font-bold text-gold-800 hover:underline aria-expanded:bg-gold-100 cursor-pointer">
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
              {/* Several rooms are named once, as the paper does; their rows below say what each is. */}
              {list.length > 1 ? (
                <p className="font-display text-[14.5px] font-bold text-ink-900 leading-tight">
                  {stayUnitsLabel(
                    list.filter(([, s]) => s.type === 'room').map(([id]) => rooms.find(r => r.id === unitOfLine(id))?.room_number).filter((n): n is number => typeof n === 'number'),
                    list.filter(([, s]) => s.type === 'venue').map(([id, s]) => unitName(id, s)))}
                </p>
              ) : list.map(([id, s]) => (
                <p key={id} className="font-display text-[14.5px] font-bold text-ink-900 leading-tight">{unitName(id, s)}</p>
              ))}
              {first && (
                <>
                  {isShort ? (
                    // The hours are picked on the line's length, under No. of night.
                    <p key={hours + '-' + half} className="text-[10.5px] font-medium text-ink-900 bw-rise">{hours} hours · {half ? 'Afternoon' : 'Morning'}</p>
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

          {/* The discounts are the totals' own ledger line, so the table stops at its charges and Room,
              Breakfast and Charge sit right under the rooms (the Paper mock, 2026-10-29). The paper
              still prints a row for each discount. */}
          {statement && (
            <StatementChargesTable items={to ? statement.lineItems : statement.lineItems.filter(l => l.band !== 'discount')} onRemove={removeLine} isNew={() => false} renderLine={renderLine}>
              {removed && (
                <tr key={removed.label}>
                  <td colSpan={6} className="pt-1 text-[10.5px] font-semibold text-muted bw-rise">
                    {removed.label} taken off · <button type="button" onClick={undo} className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
                  </td>
                </tr>
              )}
              <AddCharge sheet={sheetEl} onCharge={addCharge} cols={6}
                beside={<>
                  {list.length > 0 && <button type="button" onClick={toggle('add')} aria-expanded={isOpen('add')} aria-label="Add a room or venue" className={ADD}><Plus aria-hidden="true" className="w-3 h-3" strokeWidth={3} />Room</button>}
                  {bfRooms.length > 0 && bfLines.length === 0 && (
                    <button type="button" onClick={toggle('bf')} aria-expanded={isOpen('bf')} className={ADD}>
                      <Coffee aria-hidden="true" className="w-3.5 h-3.5 group-hover:[animation:bk-hop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]" />Breakfast
                    </button>
                  )}
                </>}
                // The form's room extras, a tap for each one more; an agency's stay has none.
                presets={firstRoomId && !to ? EXTRAS.map(x => ({ label: x.label, price: x.price, onPick: () => { setExtras(e => ({ ...e, [x.key]: e[x.key] + 1 })); setRemoved(null) } })) : undefined} />
            </StatementChargesTable>
          )}

          <div ref={totalsBox} className="grid grid-cols-[1fr_236px] gap-6 items-start">
            <div />
            <div className="relative flex flex-col gap-[3px]">
              {(!to || desk) && (
                <>
                  {/* The lines that add to the money hang a "+" in the margin beside them (Sebastian,
                      2026-10-29, the Paper mock: "I don't like the buttons to have their own row of space").
                      With no discount yet, its "+" waits beside the Sub-total. */}
                  {!to && (
                    <div className="relative flex justify-between gap-2.5">
                      {given.length === 0 && <Gut name="Discount" onClick={addDisc} expanded={pop?.kind === 'disc' && Number(pop.id) >= given.length} />}
                      <span className={label}>Sub-total</span><span key={total + discOff} className={figure + ' bill-roll'}>{money(total + discOff)}</span>
                    </div>
                  )}
                  {/* Every discount is one ledger line that opens to each one, its note, its % and what it
                      takes off in red; a tap on one opens its coupon (the Paper mock, 2026-10-29). */}
                  {!to && given.length > 0 && (
                    <>
                      <div className="relative">
                        <Gut name="Discount" onClick={addDisc} expanded={pop?.kind === 'disc' && Number(pop.id) >= given.length} />
                        <button key={landed} type="button" onClick={() => setDiscOpen(o => !o)} aria-expanded={discOpen} aria-label="The discounts" className={LEDGER + (landed ? ' bill-land' : '')}>
                          <span className="flex-1 flex items-center gap-1">Less: discount <span key={given.length} className="text-muted bill-bump">({given.length})</span><ChevronDown aria-hidden="true" className={FOLD} /></span>
                          <span key={discOff} className="w-[62px] text-right font-mono text-[11.5px] font-bold text-danger-600 bw-rise">−{money(discOff)}</span>
                        </button>
                      </div>
                      <Unfold open={discOpen}>
                        {given.map((d, i) => (
                          <button key={i} type="button" onClick={toggle('disc', String(i))} aria-expanded={isOpen('disc', String(i))} aria-label={'Change the ' + (d.note?.trim() || 'discount')}
                            style={{ '--i': i } as React.CSSProperties}
                            className="w-full grid grid-cols-[minmax(0,1fr)_auto_62px] gap-x-2 items-baseline py-1 pl-9 text-left aria-expanded:bg-gold-100 transition-colors cursor-pointer bw-rise">
                            <b className="justify-self-start max-w-full truncate border-b-[1.5px] border-dashed border-gold-400 text-[10.5px] font-bold text-gold-800">{d.note?.trim() || 'Discount'}</b>
                            <em className="not-italic font-display text-[10px] font-extrabold text-gold-800/60">{d.pct ? d.v + '%' : ''}</em>
                            <i className="not-italic justify-self-center font-mono text-[11px] font-bold text-danger-600">−{money(offOf(i))}</i>
                          </button>
                        ))}
                      </Unfold>
                    </>
                  )}
                  {/* Every payment is one ledger line too, its amount in green; it opens to each one. Writing
                      one is the "+" beside it, gone once nothing is owed. A payment is never taken back on
                      the bill: that stays on the booking panel (Sebastian, 2026-10-24). */}
                  <div className="relative">
                    {editing && desk && (
                      <WritePayment key={pays.length} sheet={sheetEl} open={writing} onOpen={o => { setWriting(o); if (o) void save() }} gone={!(due > 0)}
                        // Deposit only until money is in, and never on a short stay; Full pay is what is still owed.
                        fills={[...(pays.length || isShort ? [] : [{ label: 'Deposit', amount: Math.round(total / 2) }]), { label: 'Full pay', amount: due }]}
                        onPay={p => { setPaysOpen(true); behind(() => desk.onPay(p)) }} />
                    )}
                    {/* One payment at booking — what the guest hands over now. */}
                    {!editing && (
                      <WritePayment sheet={sheetEl} open={writing} onOpen={setWriting} gone={!!paid || !(total > 0)}
                        fills={[{ label: 'Deposit', amount: Math.round(total / 2) }, { label: 'Full pay', amount: total }]}
                        onPay={p => { setPaysOpen(true); setPaid({ amount: p.amount, method: p.method, reference: p.reference, purpose: p.purpose }) }} />
                    )}
                    <button type="button" onClick={() => setPaysOpen(o => !o)} aria-expanded={paysOpen} aria-label="The payments" className={LEDGER}>
                      <span className="flex-1 flex items-center gap-1">Less: payments
                        {payCount > 0 && <><span key={payCount} className="text-muted bill-bump">({payCount})</span><ChevronDown aria-hidden="true" className={FOLD} /></>}
                      </span>
                      <span key={received} className={'w-[62px] text-right font-mono text-[11.5px] font-bold bw-rise ' + (received > 0 ? 'text-emerald-700' : 'text-muted')}>{received > 0 ? '−' + money(received) : '—'}</span>
                    </button>
                  </div>
                  <Unfold open={paysOpen && payCount > 0}>
                    {editing && desk && pays.map((x, i) => (
                      // The payment tapped in Cash Flow is ringed in gold until the bill closes (Sebastian,
                      // 2026-10-28, "apply B"), and brought into view once.
                      <div key={x.key} className={'bw-rise' + (tapped && x.receipt === tapped ? ' bill-mark' : '')} style={{ '--i': i } as React.CSSProperties}
                        ref={tapped && x.receipt === tapped ? el => { if (el && !markSeen.current) { markSeen.current = true; el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } } : undefined}>
                        <FixPayment p={x} sheet={sheetEl} onFix={patch => behind(() => desk.onFix(x.key, patch))} onReceipt={desk.onReceipt} />
                      </div>
                    ))}
                    {editing && !desk && pays.map(x => (
                      <PayRow key={x.key} purpose={x.purpose || '—'} method={shortWay(paymentMethodLabel(x.method))} amount={'−' + money(x.amount)} under={dayOf(x.paidAt)} />
                    ))}
                    {!editing && paid && (
                      <div className="bill-ink">
                        <PayRow purpose={<>{paid.purpose}
                          <button type="button" onClick={() => setPaid(null)} aria-label={'Take the ' + paid.purpose + ' payment off'}
                            className="ml-0.5 p-0.5 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer"><X className="w-3 h-3" /></button></>}
                          method={shortWay(paymentMethodLabel(paid.method))} amount={'−' + money(paid.amount)} under="Today" />
                      </div>
                    )}
                  </Unfold>
                  {paidUp && ed?.status !== 'cancelled' && (
                    <span className="bill-paid self-end mt-1.5 mb-0.5 px-[9px] py-0.5 border-2 border-emerald-700 rounded text-[11px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">✓ Paid in full</span>
                  )}
                </>
              )}
              <div className="mt-1.5 -mx-3 px-3 py-1.5 flex items-center justify-between gap-2.5 border-[2.5px] border-ink-900 text-ink-900">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">
                  {to ? 'Total' : 'Amount due'}
                  {received > 0 && !paidUp && <span className="block text-[9px] font-normal normal-case tracking-normal mt-px text-muted">Remaining balance</span>}
                </span>
                <span className="font-display text-[24px] font-extrabold leading-none"><CountPeso roll value={to ? total : due} /></span>
              </div>
              {/* Nothing written and nobody else paying: said once, in blue, like the calendar's pill. */}
              {!to && received === 0 && !writing && <p className="mt-0.5 text-right text-[11px] font-bold text-sky-700 bw-rise">No deposit</p>}
              {ed?.status === 'cancelled' && <CancelledStamp booking={ed} />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div role="radiogroup" aria-label="Receptionist on duty" className="min-h-6 flex flex-wrap items-end gap-x-3 gap-y-1 pb-0.5 border-b border-ink-900">
                {staffNames.map(n => (
                  <Circled key={n} on={preparedBy === n} onClick={() => setPreparedBy(n)}
                    className={'!min-h-0 !py-0 !px-1.5 text-[12px] font-bold tracking-[0.02em] ' + (preparedBy === n ? 'text-ink-900' : 'text-ink-600')}>{n}</Circled>
                ))}
                {staffNames.length === 0 ? (
                  <input placeholder="NAME · ANNA" aria-label="Receptionist's name"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                    onBlur={e => {
                      const v = e.currentTarget.value.trim().toUpperCase()
                      if (v) { setStaffNames(ns => ns.includes(v) ? ns : [...ns, v]); setPreparedBy(v) }
                    }}
                    className={LINE + ' !w-24 text-[12px] font-bold'} />
                ) : (
                  <button type="button" onClick={toggle('staff')} aria-expanded={isOpen('staff')}
                    className="px-0.5 rounded text-[11px] font-bold text-gold-800 hover:underline aria-expanded:bg-gold-100 cursor-pointer inline-flex items-center gap-0.5"><Plus className="w-3 h-3" /> Someone else</button>
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
        {/* The money, pinned to the bottom of the screen as a tear-off slip while the bill's own totals are
            out of sight, and stepping aside once they are in sight, so it never shows twice (the Paper
            mock, Sebastian, 2026-10-29). */}
        {statement && (
          <div aria-hidden={totalsSeen} className={'bill-slip bill-tear-t print:hidden sticky bottom-2.5 z-20 w-full max-w-xl mx-auto -mt-16 mb-2.5 flex items-center gap-3.5 pl-4 pr-3 pt-[13px] pb-[9px] rounded-b-md bg-paper-50 border-b-[1.5px] border-ink-900 text-ink-900' + (totalsSeen ? ' away' : '')}>
            {!to && <SlipFigure name="Sub-total" value={money(total + discOff)} />}
            {!to && discOff > 0 && <SlipFigure name="Discount" value={'−' + money(discOff)} tone="text-danger-600" />}
            {received > 0 && <SlipFigure name="Paid" value={'−' + money(received)} tone="text-emerald-700" />}
            <span className="flex-1" />
            <div className="flex items-baseline gap-2 px-3 py-[5px] bg-card border-2 border-ink-900">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.1em]">{to ? 'Total' : 'Due'}</span>
              <span className="font-display text-[20px] font-extrabold tabular-nums leading-none"><CountPeso roll value={to ? total : due} /></span>
            </div>
          </div>
        )}
      </div>
      {/* The paper copy, off screen: what Print and Email send — the saved bill, with its
          payment details, policies and signatures, and none of the boxes. */}
      {ed && createPortal(
        <div ref={paperBox} aria-hidden="true" className="bill-paper fixed top-0 left-[-10000px] w-[576px]">
          {paperCopy}
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

// The boxes over the bill are written in ink like it (the Paper mock, 2026-10-29): a gold dashed line to
// write on, ✓ a gold outline, a list ruled in dots, and a way back as a quiet dotted word.
const QUIET = 'self-start mt-1 px-1 py-0.5 text-[10.5px] font-semibold text-muted border-b-[1.5px] border-dotted border-paper-400 hover:text-danger-600 hover:border-danger-600 transition-colors cursor-pointer bw-rise'
const OK = 'shrink-0 w-[30px] h-7 grid place-items-center rounded-[3px] text-gold-800 shadow-[inset_0_0_0_1.5px_#D0AB60] hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer'
const SLOT = 'min-w-0 w-40 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 py-px text-[16px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-solid'
const PICK = 'w-full flex items-center gap-2 px-2 py-[6px] border-b border-dotted border-ink-200 last:border-b-0 text-left text-[11.5px] font-semibold text-ink-900 whitespace-nowrap cursor-pointer hover:text-gold-800 focus-visible:text-gold-800 focus-visible:outline-none active:scale-[0.98] transition-[color,transform] bw-rise'
// A totals line of the ledger, and the ⌄ that says it opens.
const LEDGER = 'w-full flex items-baseline py-[3px] border-b border-dotted border-ink-200 text-left text-[10px] font-medium text-ink-900 active:scale-[0.98] transition-transform cursor-pointer group'
const FOLD = 'ml-auto mr-2 w-3 h-3 self-center text-gold-800 transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-aria-expanded:rotate-180'

/** What a folded totals line opens to: it grows from the line instead of jumping. */
function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={'grid transition-[grid-template-rows] duration-[180ms] ease-[cubic-bezier(.2,.9,.3,1.15)] ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
      <div className="overflow-hidden" inert={!open || undefined}>{open && children}</div>
    </div>
  )
}

/** One figure on the pinned money slip. */
function SlipFigure({ name, value, tone = '' }: { name: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col leading-[1.15]">
      <span className="text-[9.5px] font-semibold text-muted">{name}</span>
      <b key={value} className={'font-mono text-[12.5px] font-bold tabular-nums bw-rise ' + tone}>{value}</b>
    </span>
  )
}

/** One thing typed in the floating box and saved with its ✓: a rate, a receptionist's name. */
function TypeIn({ value, placeholder, label, money: isMoney, upper, onSave, children }: {
  value: string; placeholder: string; label: string; money?: boolean; upper?: boolean; onSave: (v: string) => void; children?: React.ReactNode
}) {
  const [v, setV] = useState(value)
  const box = useRef<HTMLInputElement>(null)
  useLateFocus(box)
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(v.trim()) }} className="flex flex-col p-1">
      <div className="flex items-end gap-1.5">
        {isMoney ? (
          <label className="flex items-baseline gap-0.5 border-b-[1.5px] border-dashed border-gold-400 focus-within:border-solid transition-colors">
            <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
            <input ref={box} inputMode="numeric" value={v} placeholder={placeholder} aria-label={label} onFocus={e => e.currentTarget.select()}
              onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')) || 0; setV(n ? n.toLocaleString() : '') }}
              className="min-w-0 w-20 bg-transparent border-0 p-0 text-right font-display text-[16px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
          </label>
        ) : (
          <input ref={box} value={v} placeholder={placeholder} aria-label={label} onChange={e => setV(upper ? e.target.value.toUpperCase() : e.target.value)} className={SLOT} />
        )}
        <button type="submit" aria-label="Save" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
      </div>
      {children}
    </form>
  )
}

/** A figure that runs to its new value instead of jumping (what a discount takes off, as it is typed). */
// The coupon's stub is a fixed width, so its perforation sits where the stub tears off.
const STUB = 84

/**
 * **The discount, as a coupon written in ink** (Sebastian, 2026-10-29: "love the coupon design", then
 * "let's redesign this to match the paper design"): the amount on a gold line with a boxed % / ₱ beside
 * it, what it is for on the gold line under them, and what it takes off in red on the stub beside ✓,
 * past a dashed perforation. The amount grows with what is typed but is never narrower than its example,
 * so it does not jump at the first key, and the note's line keeps one width (2026-10-29). It changes the
 * bill as it is typed, like the box it replaced.
 */
function DiscountPop({ disc: start, off, onChange, onDone, onNone }: {
  disc: Discount; off: number; onChange: (d: Discount) => void; onDone: () => void; onNone?: () => void
}) {
  // The coupon keeps its own copy, so a key shows at once; the bill behind it follows when it can.
  // It was the one box that drew the whole bill again on every key, and felt slower (2026-10-29).
  const [disc, setDisc] = useState(start)
  const change = (n: Discount) => { setDisc(n); startTransition(() => onChange(n)) }
  const box = useRef<HTMLInputElement>(null)
  useLateFocus(box)
  const amount = disc.v ? disc.v.toLocaleString() : ''
  return (
    <form onSubmit={e => { e.preventDefault(); onDone() }} className="flex flex-col gap-1 p-0.5">
      <div className="flex bg-card shadow-[inset_0_0_0_1px_#E5E5E5]">
        <div className="flex flex-col gap-2 py-2.5 px-3">
          <div className="flex items-center gap-2">
            <input ref={box} inputMode="numeric" placeholder={disc.pct ? '10' : '200'} aria-label="Discount" value={amount}
              onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')) || 0; change({ ...disc, v: disc.pct ? Math.min(n, 100) : n }) }}
              style={{ width: Math.max((disc.pct ? '10' : '200').length, amount.length) + 0.4 + 'ch' }}
              className="min-w-0 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 focus:border-solid rounded-none p-0 text-right font-mono text-[22px] leading-none font-bold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
            <div role="radiogroup" aria-label="Discount by" className="relative grid grid-cols-2 p-0.5 rounded-[2px] shadow-[inset_0_0_0_1px_#E5E5E5]">
              <span aria-hidden="true" className={'absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-[1px] bg-ink-900 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.56,.64,1)] ' + (disc.pct ? 'translate-x-0' : 'translate-x-full')} />
              {[true, false].map(p => (
                <button key={String(p)} type="button" role="radio" aria-checked={disc.pct === p} onClick={() => { change({ ...disc, pct: p, v: p ? Math.min(disc.v, 100) : disc.v }); box.current?.focus() }}
                  className={'relative w-[26px] h-6 font-mono text-[12px] font-bold transition-colors duration-200 cursor-pointer ' + (disc.pct === p ? 'text-white' : 'text-muted hover:text-ink-900')}>{p ? '%' : '₱'}</button>
              ))}
            </div>
          </div>
          {/* What it is for, printed on the bill (Sebastian, 2026-10-29: "include notes in discounts"). */}
          <label className="flex items-center gap-1.5 py-1 border-b-[1.5px] border-dashed border-gold-400 focus-within:border-solid text-gold-800 cursor-text">
            <Tag className="w-3 h-3 shrink-0" strokeWidth={2.4} />
            <input placeholder="Senior" aria-label="What it is for" value={disc.note || ''}
              onChange={e => change({ ...disc, note: e.target.value })}
              className="flex-1 min-w-0 w-[13ch] bg-transparent border-0 p-0 text-[13px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
          </label>
        </div>
        <div className="shrink-0 flex flex-col items-center justify-between gap-2 py-2.5 border-l-[1.5px] border-dashed border-ink-200" style={{ width: STUB }}>
          <span className={'font-mono text-[12.5px] font-extrabold tabular-nums whitespace-nowrap transition-colors ' + (off > 0 ? 'text-danger-600' : 'text-gold-200')}><span key={off} className={off > 0 ? 'bill-punch' : undefined}>−₱{off.toLocaleString()}</span></span>
          <button type="submit" aria-label="Done" className="shrink-0 w-8 h-8 grid place-items-center rounded-[3px] text-gold-800 shadow-[inset_0_0_0_1.5px_#D0AB60] hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer"><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
        </div>
      </div>
      {onNone && <button type="button" onClick={onNone} className={QUIET}>Take this one off</button>}
    </form>
  )
}

/**
 * **Who the bill goes to**, in the floating box (Sebastian, 2026-10-27: "make the agency and institution
 * function"): the agencies, then the institutions, the one chosen ticked. An agency turns the bill into
 * its statement; an institution only names it. A name typed under them is a new institution.
 */
function BillToList({ agencies, institutions, chosen, onPick, onNone }: {
  agencies: string[]; institutions: string[]; chosen: string; onPick: (name: string) => void; onNone?: () => void
}) {
  const [v, setV] = useState('')
  let i = 0
  const row = (n: string) => (
    <button key={n} type="button" onClick={() => onPick(n)} style={{ '--i': i++ } as React.CSSProperties} className={PICK}>
      {n}{n === chosen && <span aria-hidden="true" className="ml-auto">✓</span>}
    </button>
  )
  const head = 'px-2 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted'
  return (
    <div className="min-w-[220px]">
      {agencies.length > 0 && <><p className={head}>Agencies</p>{agencies.map(row)}</>}
      {institutions.length > 0 && <><p className={head}>Institutions</p>{institutions.map(row)}</>}
      <form onSubmit={e => { e.preventDefault(); if (v.trim()) onPick(v) }} className="flex items-end gap-1.5 mt-1 pt-1.5 px-1 pb-1 border-t border-ink-200">
        <input value={v} onChange={e => setV(e.target.value.toUpperCase())} placeholder="A new institution · e.g. DPWH SURIGAO" aria-label="A new institution" className={SLOT + ' !w-56'} />
        <button type="submit" aria-label="Add" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
      </form>
      {onNone && <button type="button" onClick={onNone} className={QUIET + ' px-2 pb-1'}>Not billed to anyone</button>}
    </div>
  )
}
