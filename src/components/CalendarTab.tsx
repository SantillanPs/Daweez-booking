import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useDashboardData } from './DashboardContext'
import { Booking } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { dateToString } from '../utils/helpers'
import { breakfastOn, wantsBreakfastToday, saveBreakfastChoices, breakfastAskOpen, BREAKFAST_ASK_UNTIL } from '../utils/breakfastChoice'
import { useQueryClient } from '@tanstack/react-query'
import { extendStay } from '../utils/bookingBalance'
import { clearStayHours } from '../utils/db'
import { takeFocusedBooking } from '../utils/bookingFocus'
import { ExtendStayModal } from './calendar/ExtendStayModal'
import { TimelineGrid, MoveBar } from './calendar/TimelineGrid'
import { TimelineDayInfo, buildTimelineDays, timelineHeader, sameMonth } from './calendar/timelineDays'
import { halvesByUnit } from './calendar/timelineHalves'
import { BlockDatesPane } from './calendar/BlockDatesPane'
import { CalendarToolbar } from './calendar/CalendarToolbar'
import { TodayStrip } from './calendar/TodayStrip'
import { setDeskBusy } from '../utils/deskState'
import { BreakfastPicker } from './calendar/BreakfastPicker'
import { roomDisplayName } from './calendar/bookingStyles'
import { showToast } from '../utils/toast'
import { OPEN_END, isOpenEnded } from '../utils/openBlock'
import { groupOf } from '../utils/bookingGroup'
import { moveBooking, stayTotalAfterMove } from '../utils/bookingMove'
import { normalizeVenueId } from '../utils/helpers'

// The booking form and the old-booking window are only fetched when needed, so the calendar
// itself loads faster. Both are fetched a moment after the calendar opens, so the first
// "New booking" still opens at once.
const loadForm = () => import('./WalkInBookingForm')
const loadLogOld = () => import('./calendar/LogOldBookingModal')
const WalkInBookingForm = React.lazy(() => loadForm().then(m => ({ default: m.WalkInBookingForm })))
const LogOldBookingModal = React.lazy(() => loadLogOld().then(m => ({ default: m.LogOldBookingModal })))

type Selection = { roomId?: string; venueId?: string; checkIn: Date }
type GroupSel = Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }>
type UnitSel = { checkIn: string; checkOut: string; type: 'room' | 'venue' }
/** Where a rescheduled stay is going: its new first day, and its nights once they fit (`null`
 *  while only the first day is picked). A short stay keeps its hours and has no nights. */
type MovePick = { unitId: string; type: 'room' | 'venue'; start: string; nights: number | null }

const isoDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (iso: string, n: number) => { const d = isoDay(iso); d.setDate(d.getDate() + n); return dateToString(d) }
const nightsOf = (b: Booking) => Math.max(1, Math.round((isoDay(b.check_out).getTime() - isoDay(b.check_in).getTime()) / 86400000))
const peso = (n: number) => '₱' + Math.round(n).toLocaleString()
const fmtDay = (iso: string) => isoDay(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
  const [showLogOld, setShowLogOld] = useState(false)
  /** The booking whose breakfast for today is being written down. */
  const [breakfastForId, setBreakfastForId] = useState<string | null>(null)
  const [logOldSelections, setLogOldSelections] = useState<Record<string, UnitSel>>({})
  const [logOldShort, setLogOldShort] = useState(false)
  /** The dates the block pane is holding — one day or a range, plus which units. */
  const [blockTarget, setBlockTarget] = useState<{
    units: { id: string; type: 'room' | 'venue' }[]
    label: string
    checkIn: string
    checkOut: string
  } | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState(''); const [extendError, setExtendError] = useState('')
  // **Reschedule goes back to the calendar** (the reschedule mock, "F · Back to the calendar",
  // Sebastian, 2026-10-21: "when rescheduling it goes back to the calendar to choose what date
  // and or what room"). The panel closes, the stay leaves the grid and a dashed outline marks
  // where it was; the desk taps the new first day in any room, its nights come along, and the
  // action bar saves it. It is the same booking (`moveBooking`): guest, payments, receipts and
  // invoice number stay on it.
  const [moving, setMoving] = useState<{ booking: Booking; tabTotal: number } | null>(null)
  const [movePick, setMovePick] = useState<MovePick | null>(null)

  // ── Full wizard (editing + advanced) ──
  // The rooms being corrected together, fixed when Edit is pressed: a list rebuilt on
  // every render would re-seed the form and wipe what the desk has typed.
  const [editingGroup, setEditingGroup] = useState<Booking[] | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null); const [showManualForm, setShowManualForm] = useState(false); const [formSelections, setFormSelections] = useState<Record<string, UnitSel>>({}); const [manualBookingType, setManualBookingType] = useState<'individual' | 'partner'>('individual'); const [formStayHours, setFormStayHours] = useState<number | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => { void loadForm(); void loadLogOld() }, 1500)
    return () => window.clearTimeout(id)
  }, [])

  // The desk is mid-task (a panel or form open): "What's new" is told, so it never opens by
  // itself over a panel. (A short stay's panel used to open by itself when its hours ran out;
  // the app no longer does anything on its own — Sebastian, 2026-10-20.)
  const deskBusy = showManualForm || showLogOld || !!selectedExtendBooking || !!blockTarget || !!moving
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
  const movingRef = useRef(moving)
  const movePickRef = useRef(movePick)
  React.useEffect(() => {
    timelineSelectionRef.current = timelineSelection; groupSelectionRef.current = groupSelection; bookingsRef.current = bookings; roomsRef.current = rooms; venuesRef.current = venues
    movingRef.current = moving; movePickRef.current = movePick
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
  // The stay being rescheduled is off the grid meanwhile, so its own days can be picked again.
  const halves = useMemo(() => halvesByUnit(moving ? bookings.filter(b => b.id !== moving.booking.id) : bookings, daysList), [bookings, daysList, moving])
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
  const queryClient = useQueryClient()
  const serveBreakfast = useCallback(async (booking: Booking) => {
    const choices = (booking.breakfast_choices || []).map(c => c.date === todayKey ? { ...c, served_at: new Date().toISOString() } : c)
    const before = queryClient.getQueryData<Booking[]>(['bookings'])
    // Gone from the room at once; put back if the database says no.
    queryClient.setQueryData<Booking[]>(['bookings'], old => old?.map(b => b.id === booking.id ? { ...b, breakfast_choices: choices } : b))
    try { await saveBreakfastChoices(booking.id, choices) }
    catch { queryClient.setQueryData(['bookings'], before); showToast('Could not mark the breakfast served. Please try again.', 'error') }
  }, [queryClient, todayKey])

  /** A tap on the calendar while a stay is being rescheduled. A tap is its new first day and its
   *  nights come along when they fit; otherwise, as when booking, the next tap in that room is
   *  the check-out day. A short stay takes the day tapped. */
  const pickNewPlace = useCallback((id: string, type: 'room' | 'venue', date: Date) => {
    const mv = movingRef.current?.booking
    if (!mv || type !== (mv.room_id ? 'room' : 'venue')) return
    const day = dateToString(date)
    if (day < dateToString(new Date())) return
    const free = (from: string, to: string) => type === 'room'
      ? syncEngine.isRoomAvailable(id, from, to, bookingsRef.current, mv.id)
      : syncEngine.isVenueRangeAvailable(id, from, to, bookingsRef.current, mv.id)
    const name = type === 'room' ? 'Room ' + (roomsRef.current.find(r => r.id === id)?.room_number ?? '') : (venuesRef.current.find(v => v.id === id)?.name ?? 'The venue')
    const p = movePickRef.current
    if (mv.stay_hours) {
      if (!free(day, addDays(day, 1))) showToast(name + ' is already booked that day.', 'error')
      else setMovePick({ unitId: id, type, start: day, nights: 0 })
      return
    }
    if (p && p.unitId === id && day > p.start) {
      if (!free(p.start, day)) showToast(name + ' is already booked on some of those dates.', 'error')
      else setMovePick({ ...p, nights: Math.round((date.getTime() - isoDay(p.start).getTime()) / 86400000) })
      return
    }
    if (p && p.unitId === id && day === p.start) { setMovePick(null); return }
    if (!free(day, addDays(day, 1))) { showToast(name + ' is already booked that night.', 'error'); return }
    const n = nightsOf(mv)
    setMovePick({ unitId: id, type, start: day, nights: free(day, addDays(day, n)) ? n : null })
  }, [])

  const startReschedule = useCallback((booking: Booking, tabTotal: number) => {
    setTimelineSelection(null); setGroupSelection(null); setMovePick(null)
    setMoving({ booking, tabTotal })
  }, [])
  const endReschedule = useCallback(() => { setMoving(null); setMovePick(null) }, [])
  React.useEffect(() => {
    if (!moving) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') endReschedule() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [moving, endReschedule])

  // While rescheduling, a pill is a place that is taken, not a booking to open.
  const openBooking = useCallback((b: Booking) => {
    if (movingRef.current) {
      const room = b.room_id ? roomsRef.current.find(r => r.id === b.room_id) : undefined
      showToast((room ? 'Room ' + room.room_number : venuesRef.current.find(v => v.id === normalizeVenueId(b.venue_id))?.name || 'That venue') + ' is already booked then.', 'error')
      return
    }
    setSelectedExtendBooking(b)
  }, [])

  // The booking at its new place, priced by the one rule, once a whole stay is picked.
  const moved = useMemo(() => {
    if (!moving || !movePick || (movePick.nights === null && !moving.booking.stay_hours)) return null
    const b = moving.booking
    const checkOut = addDays(movePick.start, b.stay_hours ? 1 : movePick.nights || 1)
    return moveBooking(b, { unitId: movePick.unitId, type: movePick.type, checkIn: movePick.start, checkOut }, { rooms, venues, deals: partnerDeals, tabTotal: moving.tabTotal })
  }, [moving, movePick, rooms, venues, partnerDeals])

  const confirmMove = useCallback(() => {
    if (!moving || !moved) return
    const over = Math.max(0, Number(moved.downpayment_paid || 0) - stayTotalAfterMove(moved, { rooms, venues, tabTotal: moving.tabTotal }))
    const room = moved.room_id ? rooms.find(r => r.id === moved.room_id) : undefined
    const where = room ? 'Room ' + room.room_number : venues.find(v => v.id === normalizeVenueId(moved.venue_id))?.name || 'the venue'
    endReschedule()
    // The pill lands at once (the save is optimistic) and goes back if the database says no.
    updateBooking(moved)
      .then(() => showToast('Rescheduled to ' + where + ' · ' + fmtDay(moved.check_in) + (moved.stay_hours ? '' : ' → ' + fmtDay(moved.check_out)) + (over > 0 ? '. They have paid ' + peso(over) + ' more than this stay costs.' : ''), over > 0 ? 'info' : 'success'))
      .catch(err => showToast(err instanceof Error ? err.message : 'Could not reschedule the booking. Please try again.', 'error'))
  }, [moving, moved, rooms, venues, updateBooking, endReschedule])

  // What the grid draws while rescheduling: the pick (its "In", or the whole stay), the bar's
  // words, the old place and which rows can take it.
  const moveView = useMemo(() => {
    if (!moving) return null
    const b = moving.booking
    const p = movePick
    const key = p?.type === 'room' ? 'roomId' : 'venueId'
    const selection: Selection | null = p && (p.nights === null || b.stay_hours) ? { [key]: p.unitId, checkIn: isoDay(p.start) } : null
    const group: GroupSel | null = p && p.nights !== null && !b.stay_hours ? { [p.unitId]: { checkIn: isoDay(p.start), checkOut: isoDay(addDays(p.start, p.nights)), type: p.type } } : null
    const unitId = b.room_id || normalizeVenueId(b.venue_id) || ''
    const same = !!moved && moved.check_in === b.check_in && moved.check_out === b.check_out && (moved.room_id || normalizeVenueId(moved.venue_id)) === unitId
    const opts = { rooms, venues, tabTotal: moving.tabTotal }
    const diff = moved && !same ? stayTotalAfterMove(moved, opts) - stayTotalAfterMove(b, opts) : 0
    const bar: MoveBar | null = p ? {
      chip: b.stay_hours ? b.stay_hours + ' hrs' : undefined,
      note: !moved ? 'Tap the check-out day' : same ? 'Where it is now' : diff === 0 ? 'Same price' : peso(Math.abs(diff)) + (diff > 0 ? ' more' : ' less'),
      tone: diff > 0 ? 'more' : diff < 0 ? 'less' : undefined,
      onConfirm: moved && !same ? confirmMove : undefined,
      onCancel: endReschedule,
    } : null
    return {
      selection, group, bar,
      was: { unitId, start: isoDay(b.check_in).getTime(), end: isoDay(b.check_out).getTime(), short: !!b.stay_hours },
      onlyType: (b.room_id ? 'room' : 'venue') as 'room' | 'venue',
    }
  }, [moving, movePick, moved, rooms, venues, confirmMove, endReschedule])

  const handleCellClick = useCallback((id: string, type: 'room' | 'venue', date: Date) => {
    if (movingRef.current) { pickNewPlace(id, type, date); return }
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
      setTimelineSelection(null)
      return
    }

    const isFree = (from: Date, to: Date) => type === 'room'
      ? syncEngine.isRoomAvailable(id, dateToString(from), dateToString(to), bookingsRef.current)
      : syncEngine.isVenueRangeAvailable(id, dateToString(from), dateToString(to), bookingsRef.current)
    const unitLabel = () => (type === 'room' ? 'Room' : 'Venue') + ' ' + (type === 'room' ? roomDisplayName(roomsRef.current.find(r => r.id === id)) : (venuesRef.current.find(v => v.id === id)?.name ?? id))

    // A stay can only BEGIN on a day whose night is free. A day that another guest arrives
    // on is split: its morning half is free (it ends a stay) but the stay would run into
    // that guest, so it cannot be where a stay starts.
    const pickCheckIn = () => {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      if (!isFree(date, nextDay)) {
        showToast(unitLabel() + ' is already booked that night.', 'error')
        return
      }
      setTimelineSelection({ [selIdKey]: id, checkIn: date })
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
  }, [pickNewPlace])

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
    setEditingBooking(null); setEditingGroup(null)
    setManualBookingType('individual')
    setFormStayHours(hours)
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
    setEditingBooking(null); setEditingGroup(null)
    setManualBookingType('individual')
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
    setLogOldSelections(serialized)
    setGroupSelection(null)
    setTimelineSelection(null)
    setShowLogOld(true)
  }, [])
  const clearSelection = useCallback(() => { setTimelineSelection(null); setGroupSelection(null) }, [])
  const askBreakfast = useCallback((b: Booking) => setBreakfastForId(b.id), [])

  const fmtBlockDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="font-sans flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ONE sheet (the design pass, 2026-10-04; the owner's taste: *"I don't like the boxes
          design. I prefer a more 2d, clean, minimalistic, simple, yet professional look."*).
          The window, today's counts and the grid were three cards with shadows, parted by
          gaps; they are three lines of one surface, parted by rules, and the height the gaps
          took goes to the rooms. */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card border border-soft rounded-xl">
        {/* While a stay is being rescheduled, the top line says whose it is and where it is now. */}
        {moving && (
          <div className="fd-drop shrink-0 flex items-center gap-2.5 min-h-[52px] bg-ink-900 text-white pl-4 pr-2 py-2 text-[13px] font-semibold">
            <span className="min-w-0 truncate">
              Rescheduling <b className="font-display text-gold-400">{moving.booking.guest_name}</b>
              {' · ' + (moving.booking.room_id ? 'Room ' + (rooms.find(r => r.id === moving.booking.room_id)?.room_number ?? '') : venues.find(v => v.id === normalizeVenueId(moving.booking.venue_id))?.name || '')}
              {' · ' + fmtDay(moving.booking.check_in) + (moving.booking.stay_hours ? ' · ' + moving.booking.stay_hours + ' hrs' : ' → ' + fmtDay(moving.booking.check_out))}
            </span>
            <span className="hidden sm:inline shrink-0 text-white/60">{moving.booking.stay_hours ? 'Tap the new day' : 'Tap the new first day'}</span>
            <button type="button" onClick={endReschedule}
              className="ml-auto shrink-0 h-8 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[12.5px] font-bold transition-colors active:scale-95 cursor-pointer">
              Cancel
            </button>
          </div>
        )}
        <CalendarToolbar
          monthHeader={monthHeader}
          startsToday={startsToday}
          datePickerValue={datePickerValue}
          onPrevMonth={() => stepMonth(-1)}
          onNextMonth={() => stepMonth(1)}
          onJumpToDate={jumpToDay}
          onToday={() => setMonthAnchor(todayStart())}
        >
          <TodayStrip />
        </CalendarToolbar>
        <TimelineGrid
          rooms={rooms}
          venues={venues}
          daysList={daysList}
          halves={halves}
          partnerDeals={partnerDeals}
          timelineSelection={moveView ? moveView.selection : timelineSelection}
          groupSelection={moveView ? moveView.group : groupSelection}
          handleCellClick={handleCellClick}
          setSelectedExtendBooking={openBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
          onNewBooking={confirmGroup}
          onBlockDates={openBlockPane}
          onLogOldBooking={openLogOldBooking}
          onNewShortStay={confirmShortStay}
          onClearSelection={clearSelection}
          loading={isLoading}
          breakfastToAsk={breakfastToAsk}
          onBreakfast={askBreakfast}
          breakfastReady={breakfastReady}
          onBreakfastServed={serveBreakfast}
          move={moveView?.bar}
          was={moveView?.was}
          onlyType={moveView?.onlyType}
        />
      </div>

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
          onEditBooking={() => { setEditingBooking(liveExtendBooking); setEditingGroup(groupOf(liveExtendBooking, bookings)); setFormStayHours(liveExtendBooking.stay_hours || null); setShowManualForm(true); setSelectedExtendBooking(null) }}
          onOpenBooking={b => setSelectedExtendBooking(b)}
          onReschedule={startReschedule}
        />
      )}

      {showManualForm && (
        <React.Suspense fallback={null}>
          <WalkInBookingForm
            key={editingBooking ? 'edit-' + editingBooking.id : Object.keys(formSelections).join(',') + (formStayHours ? '-h' + formStayHours : '')}
            rooms={rooms}
            venues={venues}
            bookings={bookings}
            createManualBooking={createManualBooking}
            cancelBooking={cancelBooking}
            deleteBooking={deleteBooking}
            allBookings={allBookings}
            updateBooking={updateBooking}
            initialSelections={editingBooking
              ? { [editingBooking.room_id || editingBooking.venue_id || '']: { checkIn: editingBooking.check_in, checkOut: editingBooking.check_out, type: editingBooking.room_id ? 'room' : 'venue' } }
              : formSelections}
            editingBookings={editingBooking ? (editingGroup || undefined) : undefined}
            initialBookingType={manualBookingType}
            initialStayHours={formStayHours ?? undefined}
            onClose={() => {
              setShowManualForm(false); setEditingBooking(null); setEditingGroup(null); setFormSelections({}); setFormStayHours(null)
              // Once the billing statement of an edit is closed, the booking opens again
              // in the quick view (card k134). A new booking does not ask for this.
              const created = takeFocusedBooking()
              const booking = created ? bookings.find(b => b.id === created) : undefined
              if (booking) setSelectedExtendBooking(booking)
            }}
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
          <LogOldBookingModal
            rooms={rooms}
            venues={venues}
            bookings={allBookings}
            createManualBooking={createManualBooking}
            initialSelections={logOldSelections}
            shortStay={logOldShort}
            onClose={() => setShowLogOld(false)}
          />
        </React.Suspense>
      )}

    </div>
  )
}