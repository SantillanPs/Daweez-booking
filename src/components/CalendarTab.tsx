import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useDashboardData } from './DashboardContext'
import { Booking, PaymentRecord } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { dateToString, normalizeVenueId } from '../utils/helpers'
import { breakfastOn, wantsBreakfastToday, saveBreakfastChoices, breakfastAskOpen, BREAKFAST_ASK_UNTIL } from '../utils/breakfastChoice'
import { useQueryClient } from '@tanstack/react-query'
import { extendStay } from '../utils/bookingBalance'
import { clearStayHours } from '../utils/db'
import { takeFocusedBooking } from '../utils/bookingFocus'
import { ExtendStayModal, PanelDesk } from './calendar/ExtendStayModal'
import { TimelineGrid } from './calendar/TimelineGrid'
import { TimelineDayInfo, buildTimelineDays, timelineHeader, sameMonth } from './calendar/timelineDays'
import { halvesByUnit } from './calendar/timelineHalves'
import { BlockDatesPane } from './calendar/BlockDatesPane'
import { CalendarToolbar } from './calendar/CalendarToolbar'
import { TodayStrip } from './calendar/TodayStrip'
import { CalendarSearch } from './calendar/CalendarSearch'
import { PrintPaymentReceiptModal } from './billing/PrintPaymentReceiptModal'
import { setDeskBusy } from '../utils/deskState'
import { BreakfastPicker } from './calendar/BreakfastPicker'
import { roomDisplayName } from './calendar/bookingStyles'
import { showToast } from '../utils/toast'
import { OPEN_END, isOpenEnded } from '../utils/openBlock'
import { groupOf } from '../utils/bookingGroup'
import { shortStayOut, shortStayTimeUp } from '../utils/shortStay'
import { recomputeBalance } from '../utils/bookingBalance'
import { readBookingFoodTotal } from '../utils/orderSlips'
import { ShortStayAlerts } from './calendar/ShortStayAlerts'
import { clashIn, dayHalf } from '../utils/halfDays'

// The bills are only fetched when needed, so the calendar itself loads faster. Both are
// fetched a moment after the calendar opens, so the first "New booking" still opens at once.
const loadLogOldBill = () => import('./calendar/LogOldBill')
const LogOldBill = React.lazy(() => loadLogOldBill().then(m => ({ default: m.LogOldBill })))
const loadNewBill = () => import('./calendar/NewBookingBill')
const NewBookingBill = React.lazy(() => loadNewBill().then(m => ({ default: m.NewBookingBill })))

/** One picked day. `half` is the half a short stay would take (0 the morning, 1 the
 *  afternoon) and `open` which of that morning, that afternoon and the next morning are free. */
type Selection = { roomId?: string; venueId?: string; checkIn: Date; half: 0 | 1; open: [boolean, boolean, boolean] }
type GroupSel = Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }>
type UnitSel = { checkIn: string; checkOut: string; type: 'room' | 'venue' }


export function CalendarTab() {
  const { rooms, venues, bookings, allBookings, partnerDeals, isLoading, createManualBooking, cancelBooking, deleteBooking, updateBooking } = useDashboardData()

  // ── Month / timeline state ──
  // The anchor IS the day the 31-day window starts on (card k154 follow-up): Today
  // sets today, ‹ › set the 1st of the month they step to, and the toolbar's date box
  // sets the day the desk picked.
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [timelineSelection, setTimelineSelection] = useState<Selection | null>(null); const [groupSelection, setGroupSelection] = useState<GroupSel | null>(null)

  // ── Booking detail / extension modal ──
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  // What the calendar search opened: a billing statement or a receipt (`CalendarSearch`).
  const [foundReceipt, setFoundReceipt] = useState<{ booking: Booking; record: PaymentRecord; covered: Booking[] } | null>(null)
  const [showLogOld, setShowLogOld] = useState(false)
  /** The booking whose breakfast for today is being written down. */
  const [breakfastForId, setBreakfastForId] = useState<string | null>(null)
  const [logOldSelections, setLogOldSelections] = useState<Record<string, UnitSel>>({})
  const [logOldShort, setLogOldShort] = useState(false)
  const [logOldHalf, setLogOldHalf] = useState<0 | 1>(1)
  /** The dates the block pane is holding — one day or a range, plus which units. */
  const [blockTarget, setBlockTarget] = useState<{
    units: { id: string; type: 'room' | 'venue' }[]
    label: string
    checkIn: string
    checkOut: string
  } | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState(''); const [extendError, setExtendError] = useState('')

  // ── Full wizard (editing + advanced) ──
  // The rooms being corrected together, fixed when Edit is pressed: a list rebuilt on
  // every render would re-seed the form and wipe what the desk has typed.
  const [showManualForm, setShowManualForm] = useState(false); const [formSelections, setFormSelections] = useState<Record<string, UnitSel>>({}); const [formStayHours, setFormStayHours] = useState<number | null>(null); const [formStayHalf, setFormStayHalf] = useState<0 | 1>(1)
  // **The one bill** open over a booking's panel (Sebastian, 2026-10-24: "merge everything"): every
  // way into a booking's bill opens it, and its money goes through the panel beneath (`deskRef`).
  const [billOf, setBillOf] = useState<Booking | null>(null)
  const deskRef = useRef<PanelDesk | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => { void loadNewBill(); void loadLogOldBill() }, 1500)
    return () => window.clearTimeout(id)
  }, [])

  // The desk is mid-task (a panel or form open): "What's new" is told, so it never opens by
  // itself over a panel. (A short stay's panel used to open by itself when its hours ran out;
  // the app no longer does anything on its own — Sebastian, 2026-10-20.)
  const deskBusy = showManualForm || showLogOld || !!selectedExtendBooking || !!blockTarget || !!billOf
  React.useEffect(() => {
    setDeskBusy(deskBusy)
    return () => setDeskBusy(false)
  }, [deskBusy])

  // Latest-value refs keep the click handler stable so a date click never
  // re-renders the whole grid.
  const timelineSelectionRef = useRef(timelineSelection)
  const groupSelectionRef = useRef(groupSelection)
  const bookingsRef = useRef(bookings)
  const roomsRef = useRef(rooms)
  const venuesRef = useRef(venues)
  React.useEffect(() => {
    timelineSelectionRef.current = timelineSelection; groupSelectionRef.current = groupSelection; bookingsRef.current = bookings; roomsRef.current = rooms; venuesRef.current = venues
  })

  // A booking opened from the Bookings list lands here: the calendar moves to the
  // booking's own dates when they are off screen, and its panel opens. Read once, off the
  // effect body, the same way the Restaurant screen takes its hand-off.
  React.useEffect(() => {
    queueMicrotask(() => {
      const id = takeFocusedBooking()
      const wanted = id ? bookingsRef.current.find(b => b.id === id) : undefined
      if (!wanted) return
      const [y, m, d] = wanted.check_in.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      const first = new Date(); first.setHours(0, 0, 0, 0)
      const last = new Date(first); last.setDate(last.getDate() + 30)
      if (start < first || start > last) setMonthAnchor(start)
      setExtendError('')
      setExtendCheckoutDate(isOpenEnded(wanted) ? '' : wanted.check_out)
      setSelectedExtendBooking(wanted)
    })
  }, [])

  // Today's own key: the list is rebuilt if the app is left open past midnight.
  const todayKey = dateToString(new Date())
  const daysList = useMemo<TimelineDayInfo[]>(
    () => buildTimelineDays(monthAnchor),
    // todayKey is not read inside on purpose: it IS the midnight roll-over trigger,
    // so leaving the app open overnight rebuilds the day list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthAnchor, todayKey]
  )
  const monthHeader = useMemo(() => timelineHeader(daysList), [daysList])
  const startsToday = daysList[0]?.isToday === true

  // The slide-over opens on the LIVE row, never on the object the grid happened to
  // be holding when the pill was clicked. The grid is memoized, so a cell can keep
  // an older booking after a save that only changed the stage (check-in / check-out
  // are not part of the pill's own badge, so nothing forced it to re-render) — and
  // reopening the booking then showed "Check in" again for a guest already in.
  const liveExtendBooking = selectedExtendBooking
    ? bookings.find(b => b.id === selectedExtendBooking.id) || selectedExtendBooking
    : null


  const breakfastFor = breakfastForId ? bookings.find(b => b.id === breakfastForId) || null : null

  // Who fills each half of each day, per room and venue (see `timelineHalves`).
  const halves = useMemo(() => halvesByUnit(bookings, daysList), [bookings, daysList])
  // The rooms still to be asked about breakfast this morning. Read off every booking, not
  // off the grid: a guest who has overstayed has no pill on it but is still in the room.
  // **Only in the morning** (Sebastian, 2026-10-14; 11 AM since 2026-10-20): breakfast is not asked
  // after 11, so the cup is gone then. A timer flips it at 11, so a calendar left open all morning does not keep it.
  const [morning, setMorning] = useState(() => breakfastAskOpen())
  useEffect(() => {
    if (!morning) return
    const noon = new Date()
    noon.setHours(BREAKFAST_ASK_UNTIL, 0, 0, 0)
    const id = setTimeout(() => setMorning(false), noon.getTime() - new Date().getTime())
    return () => clearTimeout(id)
  }, [morning])
  const breakfastToAsk = useMemo(() => {
    const ask: Record<string, Booking> = {}
    if (!morning) return ask
    bookings.forEach(b => { if (b.room_id && wantsBreakfastToday(b, todayKey) && !breakfastOn(b, todayKey)) ask[b.room_id] = b })
    return ask
  }, [bookings, todayKey, morning])

  // **A cooked breakfast comes back to the desk** (Sebastian, 2026-10-09: "after the kitchen
  // finishes cooking, where does it go next?"). It used to leave the kitchen's screen and
  // nobody was told. The room's cup returns in green until the desk has brought it.
  const breakfastReady = useMemo(() => {
    const ready: Record<string, Booking> = {}
    bookings.forEach(b => {
      const c = breakfastOn(b, todayKey)
      if (b.room_id && c && c.items.length > 0 && c.ready_at && !c.served_at) ready[b.room_id] = b
    })
    return ready
  }, [bookings, todayKey])
  // **A short stay whose time is up** (#7, the "Short Stay Out" mock, 2026-10-24). The calendar
  // keeps the one clock, a look every 20 seconds, and hands the cells a yes or no.
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => { const id = window.setInterval(() => setClock(Date.now()), 20000); return () => window.clearInterval(id) }, [])
  // An answer hides its banner at once; the save goes on behind it. Keyed by the time it
  // answered, so a stay given another hour asks again when that hour is up.
  const [answered, setAnswered] = useState<Record<string, number>>({})
  const timeUpKey = bookings.filter(b => b.stay_hours && shortStayTimeUp(b, clock)).map(b => b.id).join(',')
  const timeUp = useMemo(() => Object.fromEntries(timeUpKey ? timeUpKey.split(',').map(id => [id, true]) : []), [timeUpKey])
  const timeUpDue = useMemo(() => bookings.filter(b => timeUp[b.id] && answered[b.id] !== shortStayOut(b)?.getTime()), [bookings, timeUp, answered])
  const answerTimeUp = useCallback(async (b: Booking, patch: Partial<Booking>, failed: string) => {
    const at = shortStayOut(b)?.getTime() ?? 0
    setAnswered(a => ({ ...a, [b.id]: at }))
    try {
      const tabTotal = await readBookingFoodTotal(b.id)
      await updateBooking(recomputeBalance({ ...b, ...patch }, { rooms, venues, tabTotal }))
    } catch {
      setAnswered(a => { const rest = { ...a }; delete rest[b.id]; return rest })
      showToast(failed, 'error')
    }
  }, [rooms, venues, updateBooking])
  const timeUpOut = useCallback((b: Booking) => void answerTimeUp(b, { actual_check_out: new Date().toISOString() }, 'Could not note the check-out. Please try again.'), [answerTimeUp])
  const timeUpMore = useCallback((b: Booking) => void answerTimeUp(b, { late_check_out_hours: Number(b.late_check_out_hours || 0) + 1 }, 'Could not add the hour. Please try again.'), [answerTimeUp])

  const queryClient = useQueryClient()
  const serveBreakfast = useCallback(async (booking: Booking) => {
    const choices = (booking.breakfast_choices || []).map(c => c.date === todayKey ? { ...c, served_at: new Date().toISOString() } : c)
    const before = queryClient.getQueryData<Booking[]>(['bookings'])
    // Gone from the room at once; put back if the database says no.
    queryClient.setQueryData<Booking[]>(['bookings'], old => old?.map(b => b.id === booking.id ? { ...b, breakfast_choices: choices } : b))
    try { await saveBreakfastChoices(booking.id, choices) }
    catch { queryClient.setQueryData(['bookings'], before); showToast('Could not mark the breakfast served. Please try again.', 'error') }
  }, [queryClient, todayKey])

  const handleCellClick = useCallback((id: string, type: 'room' | 'venue', date: Date, half?: 0 | 1) => {
    const curTimeline = timelineSelectionRef.current
    const curGroup = groupSelectionRef.current

    if (curGroup && curGroup[id]) {
      setGroupSelection(prev => {
        if (!prev) return null
        const next = { ...prev }
        delete next[id]
        return Object.keys(next).length === 0 ? null : next
      })
      return
    }

    const selIdKey = type === 'room' ? 'roomId' : 'venueId'
    if (curTimeline && curTimeline[selIdKey] === id && date.toDateString() === curTimeline.checkIn.toDateString()) {
      // The other half of the picked day moves the pick there; the same one lets go.
      if (half !== undefined && half !== curTimeline.half) setTimelineSelection({ ...curTimeline, half })
      else setTimelineSelection(null)
      return
    }

    const isFree = (from: Date, to: Date) => type === 'room'
      ? syncEngine.isRoomAvailable(id, dateToString(from), dateToString(to), bookingsRef.current)
      : syncEngine.isVenueRangeAvailable(id, dateToString(from), dateToString(to), bookingsRef.current)
    const unitLabel = () => (type === 'room' ? 'Room' : 'Venue') + ' ' + (type === 'room' ? roomDisplayName(roomsRef.current.find(r => r.id === id)) : (venuesRef.current.find(v => v.id === id)?.name ?? id))

    // A night can only BEGIN on a day whose afternoon and next morning are free, but since
    // 2026-10-25 (the free-half mock) a single free half is still a pick: a short stay can
    // go there. The pick says which halves are free, so the bar offers only what fits.
    const pickCheckIn = () => {
      const d = dayHalf(dateToString(date))
      const unitOf = (b: Booking) => (type === 'room' ? b.room_id : normalizeVenueId(b.venue_id))
      const own = type === 'room' ? id : normalizeVenueId(id) || id
      const free = (k: number) => !clashIn(unitOf, own, k, k + 1, bookingsRef.current)
      const open: Selection['open'] = [free(d), free(d + 1), free(d + 2)]
      const at = half ?? (open[1] ? 1 : 0)
      if (!open[at]) {
        showToast(unitLabel() + ' is already booked then.', 'error')
        return
      }
      setTimelineSelection({ [selIdKey]: id, checkIn: date, half: at, open })
    }

    if (!curTimeline || (curTimeline.roomId !== id && curTimeline.venueId !== id)) {
      pickCheckIn()
    } else {
      if (date <= curTimeline.checkIn) {
        pickCheckIn()
        return
      }
      if (!isFree(curTimeline.checkIn, date)) {
        showToast(unitLabel() + ' is already booked on some of those dates.', 'error')
        setTimelineSelection(null)
        return
      }
      setGroupSelection(prev => ({ ...(prev || {}), [id]: { checkIn: curTimeline.checkIn, checkOut: date, type } }))
      setTimelineSelection(null)
    }
  }, [])

  const handleExtendStaySubmit = async (e: React.FormEvent, tabTotal: number) => {
    e.preventDefault(); setExtendError('')
    if (!selectedExtendBooking || !extendCheckoutDate) return
    try {
      const isRoom = !!selectedExtendBooking.room_id
      const availOk = isRoom
        ? syncEngine.isRoomAvailable(selectedExtendBooking.room_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)
        : syncEngine.isVenueRangeAvailable(selectedExtendBooking.venue_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)
      if (!availOk) { setExtendError('Overlap collision — already reserved.'); return }
      const current = await syncEngine.getBookings()
      const target = current.find(b => b.id === selectedExtendBooking.id) || selectedExtendBooking
      await updateBooking(extendStay(target, extendCheckoutDate, { rooms, venues, tabTotal }))
      if (target.stay_hours) await clearStayHours(target.id)
      setSelectedExtendBooking(null)
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : 'Unknown error during stay extension')
    }
  }

  /** Short stay: the SAME flow as New booking — pick on the grid first, then press the button — except a short stay needs ONE day rather than a range, because the room is taken for that whole day. Check-out is filled in as the next day for the desk, and the hours tapped on the bar (3, 6 or 12) travel into the form already chosen. */
  const confirmShortStay = useCallback((hours: number) => {
    const picked = timelineSelectionRef.current
    // A room, or since 2026-10-20 the Gazebo or the Garden (sold by the hour too).
    const unitId = picked?.roomId || picked?.venueId
    if (!picked || !unitId) return
    const checkIn = new Date(picked.checkIn)
    const checkOut = new Date(picked.checkIn)
    checkOut.setDate(checkOut.getDate() + 1)
    setTimelineSelection(null)
    setGroupSelection(null)
    setFormStayHours(hours)
    setFormStayHalf(picked.half)
    setFormSelections({ [unitId]: { checkIn: dateToString(checkIn), checkOut: dateToString(checkOut), type: picked.roomId ? 'room' : 'venue' } })
    setShowManualForm(true)
  }, [])

  // The grid's actions stay the same functions from render to render (they read the picks
  // through the refs above): a new function each time made the memoized grid redraw every
  // room and day whenever anything on this screen changed, such as opening a booking.
  const confirmGroup = useCallback(() => {
    const groupSelection = groupSelectionRef.current
    if (!groupSelection) return
    const serialized: Record<string, UnitSel> = {}
    Object.entries(groupSelection).forEach(([id, sel]) => {
      serialized[id] = { checkIn: dateToString(sel.checkIn), checkOut: dateToString(sel.checkOut), type: sel.type }
    })
    setGroupSelection(null)
    setTimelineSelection(null)
    setFormStayHours(null)
    setFormSelections(serialized)
    setShowManualForm(true)
  }, [])

  /** Who the block is for, in the pane's own line: the room's name, or how many units. */
  const blockLabel = useCallback((units: { id: string; type: 'room' | 'venue' }[]) => {
    if (units.length !== 1) return units.length + ' units'
    const u = units[0]
    if (u.type === 'room') {
      const room = roomsRef.current.find(r => r.id === u.id)
      return room ? roomDisplayName(room) : 'Room'
    }
    return venuesRef.current.find(v => v.id === u.id)?.name || 'Venue'
  }, [])

  /**
   * Block the dates that were picked (the owner's design, 2026-09).
   *
   * The same pick that feeds a booking feeds the block — one day or a range — so the pane
   * only has to ask `why`. Blocking used to be a MODE of the booking form (a
   * `Booking / Block dates` toggle in its header turned the whole form into a block-only
   * form); the owner moved it here, beside every other thing the desk can do with the
   * dates they just picked.
   */
  const openBlockPane = useCallback(() => {
    const picked = timelineSelectionRef.current
    const groupSelection = groupSelectionRef.current
    const units: { id: string; type: 'room' | 'venue' }[] = []
    let checkIn = ''
    let checkOut = ''
    if (groupSelection && Object.keys(groupSelection).length > 0) {
      Object.entries(groupSelection).forEach(([id, sel]) => {
        units.push({ id, type: sel.type })
        const from = dateToString(sel.checkIn)
        const to = dateToString(sel.checkOut)
        if (!checkIn || from < checkIn) checkIn = from
        if (!checkOut || to > checkOut) checkOut = to
      })
    } else if (picked?.roomId || picked?.venueId) {
      units.push({ id: (picked.roomId || picked.venueId) as string, type: picked.roomId ? 'room' : 'venue' })
      checkIn = dateToString(picked.checkIn)
      const next = new Date(picked.checkIn)
      next.setDate(next.getDate() + 1)
      checkOut = dateToString(next)
    }
    if (units.length === 0 || !checkIn) return
    setBlockTarget({ units, label: blockLabel(units), checkIn, checkOut })
    setTimelineSelection(null)
    setGroupSelection(null)
  }, [blockLabel])

  /** One block per picked unit, so a whole floor can be blocked in one go. */
  const createBlocks = async (notes: string, openEnded: boolean) => {
    if (!blockTarget) return
    try {
      for (const u of blockTarget.units) {
        // No end date yet: the block runs on until it is ended — or, when the unit already
        // has a booking further ahead, up to that booking, which the desk is told about.
        let checkOut = blockTarget.checkOut
        if (openEnded) {
          const next = bookings
            .filter(b => (u.type === 'room' ? b.room_id === u.id : syncEngine.normalizeVenueId(b.venue_id) === syncEngine.normalizeVenueId(u.id)))
            .filter(b => b.check_in > blockTarget.checkIn)
            .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
          checkOut = next ? next.check_in : OPEN_END
          if (next) showToast(blockLabel([u]) + ' is booked from ' + fmtBlockDate(next.check_in) + ', so the block runs until then.', 'info')
        }
        await createManualBooking({
          roomId: u.type === 'room' ? u.id : undefined,
          venueId: u.type === 'venue' ? u.id : undefined,
          guestName: 'Admin Date Block',
          guestEmail: 'admin@daweez-booking.vercel.app',
          guestPhone: 'None',
          checkIn: blockTarget.checkIn,
          checkOut,
          source: 'manual',
          status: 'blocked',
          notes,
        })
      }
      setBlockTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not block those dates. Please try again.', 'error')
    }
  }


  // What the toolbar's date box shows, and the three ways the window moves (card
  // k154 follow-up). Each control decides the day itself — nothing is guessed from
  // the date afterwards, because "the 1st of the current month" is exactly what the
  // desk types when they want the 1st: guessing sent 1 September back to today.
  const datePickerValue = dateToString(monthAnchor)
  const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
  const stepMonth = (delta: number) => {
    const target = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1)
    // Stepping back into the month we are living in opens on today, so arriving by
    // arrow never buries today off the right edge (that is the k154 rule).
    setMonthAnchor(sameMonth(target, new Date()) ? todayStart() : target)
  }
  const jumpToDay = (value: string) => {
    // Parsed by hand: `new Date('2026-12-15')` is UTC midnight, which is 15 Dec only
    // from 8am in UTC+8 — the desk would pick a day and land on the one before it.
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return
    setMonthAnchor(new Date(y, m - 1, d))
  }

  /** Log an old paper booking for the picked dates — the toolbar icon and the action
   *  bar's own icon both come here, so there is one way to start it. */
  const openLogOldBooking = useCallback(() => {
    const serialized: Record<string, UnitSel> = {}
    const picked = timelineSelectionRef.current
    const groupSelection = groupSelectionRef.current
    const roomId = picked?.roomId
    if (groupSelection) {
      Object.entries(groupSelection).forEach(([id, sel]) => { serialized[id] = { checkIn: dateToString(sel.checkIn), checkOut: dateToString(sel.checkOut), type: sel.type } })
    } else if (picked && roomId) {
      const next = new Date(picked.checkIn); next.setDate(next.getDate() + 1)
      serialized[roomId] = { checkIn: dateToString(picked.checkIn), checkOut: dateToString(next), type: 'room' }
    }
    // ONE day picked is how a short stay starts (its bar offers 3h · 6h · 12h), so the paper
    // opens as a short stay; it opened on Overnight for one night.
    setLogOldShort(!groupSelection && !!(picked && roomId))
    setLogOldHalf(picked?.half ?? 1)
    setLogOldSelections(serialized)
    setGroupSelection(null)
    setTimelineSelection(null)
    setShowLogOld(true)
  }, [])
  // A booking found by the search: the calendar moves to its dates when they are off screen,
  // its pill pulses so the desk sees where it is, then its panel opens.
  const openFound = (b: Booking) => {
    const [y, m, d] = b.check_in.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const last = new Date(monthAnchor); last.setDate(last.getDate() + 30)
    if (start < monthAnchor || start > last) setMonthAnchor(start)
    setTimeout(() => {
      const pill = document.querySelector<HTMLElement>('[data-pill="' + b.id + '"]')
      if (pill) {
        pill.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
        pill.classList.remove('cs-found'); void pill.offsetWidth; pill.classList.add('cs-found')
      }
    }, 60)
    setTimeout(() => {
      setExtendError('')
      setExtendCheckoutDate(isOpenEnded(b) ? '' : b.check_out)
      setSelectedExtendBooking(b)
    }, 450)
  }
  const clearSelection = useCallback(() => { setTimelineSelection(null); setGroupSelection(null) }, [])
  /** The bar's Morning / Afternoon: which half of the picked day a short stay takes. */
  const pickHalf = useCallback((half: 0 | 1) => setTimelineSelection(s => (s ? { ...s, half } : s)), [])
  const askBreakfast = useCallback((b: Booking) => setBreakfastForId(b.id), [])

  const fmtBlockDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const closeManualForm = () => {
    setShowManualForm(false); setFormSelections({}); setFormStayHours(null)
    // Once the billing statement of an edit is closed, the booking opens again
    // in the quick view (card k134). A new booking does not ask for this.
    const created = takeFocusedBooking()
    const booking = created ? bookings.find(b => b.id === created) : undefined
    if (booking) setSelectedExtendBooking(booking)
  }

  return (
    <div className="font-sans flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ONE sheet (the design pass, 2026-10-04; the owner's taste: *"I don't like the boxes
          design. I prefer a more 2d, clean, minimalistic, simple, yet professional look."*).
          The window, today's counts and the grid were three cards with shadows, parted by
          gaps; they are three lines of one surface, parted by rules, and the height the gaps
          took goes to the rooms. */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card border border-soft rounded-xl">
        <CalendarToolbar
          monthHeader={monthHeader}
          startsToday={startsToday}
          datePickerValue={datePickerValue}
          onPrevMonth={() => stepMonth(-1)}
          onNextMonth={() => stepMonth(1)}
          onJumpToDate={jumpToDay}
          onToday={() => setMonthAnchor(todayStart())}
        >
          <CalendarSearch allBookings={allBookings} rooms={rooms} venues={venues}
            onBooking={openFound} onBill={b => { openFound(b); setBillOf(b) }} onReceipt={(booking, record, covered) => setFoundReceipt({ booking, record, covered })} />
          <TodayStrip />
        </CalendarToolbar>
        <TimelineGrid
          rooms={rooms}
          venues={venues}
          daysList={daysList}
          halves={halves}
          partnerDeals={partnerDeals}
          timelineSelection={timelineSelection}
          groupSelection={groupSelection}
          handleCellClick={handleCellClick}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
          onNewBooking={confirmGroup}
          onBlockDates={openBlockPane}
          onLogOldBooking={openLogOldBooking}
          onNewShortStay={confirmShortStay}
          onClearSelection={clearSelection}
          onPickHalf={pickHalf}
          loading={isLoading}
          breakfastToAsk={breakfastToAsk}
          onBreakfast={askBreakfast}
          breakfastReady={breakfastReady}
          onBreakfastServed={serveBreakfast}
          timeUp={timeUp}
        />
      </div>

      <ShortStayAlerts due={timeUpDue} rooms={rooms} venues={venues} onOut={timeUpOut} onMore={timeUpMore} />

      {foundReceipt && (
        <PrintPaymentReceiptModal booking={foundReceipt.booking} record={foundReceipt.record} rooms={rooms} venues={venues}
          covered={foundReceipt.covered.length > 1 ? foundReceipt.covered : undefined} onClose={() => setFoundReceipt(null)} />
      )}
      {liveExtendBooking && (
        <ExtendStayModal
          key={liveExtendBooking.id}
          booking={liveExtendBooking}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          allBookings={allBookings}
          extendCheckoutDate={extendCheckoutDate}
          extendError={extendError}
          onClose={() => setSelectedExtendBooking(null)}
          onExtendStaySubmit={handleExtendStaySubmit}
          setExtendCheckoutDate={setExtendCheckoutDate}
          onCancelBooking={cancelBooking}
          onUpdateBooking={updateBooking}
          onOpenBill={() => setBillOf(liveExtendBooking)}
          deskRef={deskRef}
          onOpenBooking={b => setSelectedExtendBooking(b)}
        />
      )}

      {billOf && (
        <React.Suspense fallback={null}>
          <NewBookingBill
            key={'bill-' + (billOf.group_id || billOf.id)}
            rooms={rooms}
            venues={venues}
            bookings={bookings}
            allBookings={allBookings}
            createManualBooking={createManualBooking}
            updateBooking={updateBooking}
            cancelBooking={cancelBooking}
            deleteBooking={deleteBooking}
            editing={groupOf(bookings.find(b => b.id === billOf.id) || billOf, bookings)}
            desk={{
              onPay: p => deskRef.current ? deskRef.current.onPay(p) : showToast('Open the booking again to take the payment.', 'error'),
              onFix: (key, patch) => deskRef.current?.onFix(key, patch),
              onReceipt: n => deskRef.current?.onReceipt(n),
            }}
            // A room swapped or taken off is a new row: the bill and the panel follow the booking.
            onSaved={rows => {
              setBillOf(b => !b || rows.some(r => r.id === b.id) ? b : rows[0])
              setSelectedExtendBooking(b => b && !rows.some(r => r.id === b.id) ? rows[0] : b)
            }}
            onClose={() => setBillOf(null)}
          />
        </React.Suspense>
      )}

      {/* A new booking is made on a blank bill (2026-10-23; the only way since 2026-10-24). */}
      {showManualForm && (
        <React.Suspense fallback={null}>
          <NewBookingBill
            key={Object.keys(formSelections).join(',') + (formStayHours ? '-h' + formStayHours : '')}
            rooms={rooms}
            venues={venues}
            bookings={bookings}
            allBookings={allBookings}
            createManualBooking={createManualBooking}
            updateBooking={updateBooking}
            cancelBooking={cancelBooking}
            deleteBooking={deleteBooking}
            initialSelections={formSelections}
            initialStayHours={formStayHours ?? undefined}
            initialStayHalf={formStayHalf}
            // Booked: the panel opens with its one bill over it, ready for the money.
            onBooked={rows => { closeManualForm(); setSelectedExtendBooking(rows[0]); setBillOf(rows[0]) }}
            onClose={closeManualForm}
          />
        </React.Suspense>
      )}

      {/* Blocking the picked dates: a small pane of its own, never the booking form
          (the owner's design, 2026-09 — the form's Block mode is gone). */}
      {blockTarget && (
        <BlockDatesPane
          unitLabel={blockTarget.label}
          checkIn={blockTarget.checkIn}
          checkOut={blockTarget.checkOut}
          fmt={fmtBlockDate}
          onSubmit={createBlocks}
          onClose={() => setBlockTarget(null)}
        />
      )}

      {breakfastFor && (
        <BreakfastPicker
          key={breakfastFor.id}
          booking={breakfastFor}
          date={todayKey}
          place={'Room ' + (rooms.find(r => r.id === breakfastFor.room_id)?.room_number ?? '')}
          onClose={() => setBreakfastForId(null)}
        />
      )}

      {showLogOld && (
        <React.Suspense fallback={null}>
          <LogOldBill rooms={rooms} venues={venues} bookings={allBookings} createManualBooking={createManualBooking}
            initialSelections={logOldSelections} shortStay={logOldShort} shortHalf={logOldHalf} onClose={() => setShowLogOld(false)} />
        </React.Suspense>
      )}

    </div>
  )
}