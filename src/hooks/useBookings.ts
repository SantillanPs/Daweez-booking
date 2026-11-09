import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isRoomAvailable, isVenueRangeAvailable } from '../utils/availability'
import { cancelBooking as cancelBookingDb, deleteBooking as deleteBookingDb, getBookings, getFeeds, getRooms, getVenues, insertBooking, saveFeeds, setBookingGroup, updateBooking as updateBookingDb, updateRoomBreakfastPrice as updateRoomBreakfastPriceDb, updateRoomHourPrices as updateRoomHourPricesDb, updateRoomRate as updateRoomRateDb } from '../utils/db'
import { deleteExpense as deleteExpenseDb, deleteExpenseCategory as deleteExpenseCategoryDb, getExpenseCategories, getExpenses, insertExpense, insertExpenseCategory, updateExpenseCategory as updateExpenseCategoryDb } from '../utils/expenses'
import { randomUUID } from '../utils/helpers'
import { runCalendarSync } from '../utils/otaSync'
import { deletePartnerDeal as deletePartnerDealDb, getPartnerDeals, insertPartnerDeal, savePartnerDeals as savePartnerDealsDb } from '../utils/partnerDeals'
import { calculatePricing } from '../utils/pricing'
import { Booking, Room, Venue, SyncFeed, BookingSource, BreakfastOrder, EquipmentRental, EventAddons, Companion, PartnerDeal, AppliedDiscount, PaymentRecord } from '../types/booking'
import { getRateConfig } from '../utils/rateConfig'
import { Expense, ExpenseCategory } from '../types/expense'
import { useRealtimeBookings } from './useRealtimeBookings'
import { useCallback, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabaseClient'
import { noteMove } from '../utils/movedFrom'
import { billKey, billLeads, getPayments, PaymentRow, withBillPayments, withPayments } from '../utils/payments'
import { groupOf } from '../utils/bookingGroup'
import { changedRows, onLead } from '../utils/bookingBalance'
import { resettle } from '../utils/billPayment'

type MutationContext = { previous: Booking[] | undefined; pays?: PaymentRow[] }

export function useBookings() {
  const queryClient = useQueryClient()

  // 1. Fetch Rooms from Supabase (dynamic, reflects DB price changes)
  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => getRooms(),
    staleTime: 5 * 60 * 1000, // 5 min — Realtime invalidation keeps it fresh
  })

  // 2. Fetch Venues from Supabase (dynamic, reflects DB price changes)
  const { data: venues = [], isLoading: isLoadingVenues } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => getVenues(),
    staleTime: 5 * 60 * 1000,
  })

  // 3. Fetch Bookings (initial load only — Realtime subscription keeps cache fresh)
  const { data: allBookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      return await getBookings()
    },
    staleTime: Infinity, // Realtime handles freshness; don't re-fetch on focus/mount
  })

  // Every bill's payments (`utils/payments.ts`). Each change is laid onto the bookings' cache, on each
  // bill's leading room, so every screen keeps reading a booking's payments where it always did.
  const { data: payments, isLoading: isLoadingPayments } = useQuery<PaymentRow[]>({
    queryKey: ['payments'],
    queryFn: getPayments,
    staleTime: Infinity,
  })
  useEffect(() => {
    if (payments) queryClient.setQueryData<Booking[]>(['bookings'], list => list && withPayments(list, payments))
  }, [payments, queryClient])
  // A list put in the cache gets the payments laid on it again: a row back from the database holds none.
  const attach = useCallback((list: Booking[]) => {
    const pays = queryClient.getQueryData<PaymentRow[]>(['payments'])
    return pays ? withPayments(list, pays) : list
  }, [queryClient])

  // `bookings` is what every screen works with: the stays that still hold a room. A
  // cancelled booking is kept (its payments and receipts are real) but it has given its
  // room back, so it is left out here and only `allBookings` carries it — for the
  // Bookings list, the daily money sheet, and so a receipt number is never used twice.
  const bookings = useMemo(() => allBookings.filter(b => b.status !== 'cancelled'), [allBookings])

  // 4. Fetch iCal Feeds
  const { data: feeds = [], isLoading: isLoadingFeeds } = useQuery<SyncFeed[]>({
    queryKey: ['feeds'],
    queryFn: async () => {
      return await getFeeds()
    },
    staleTime: Infinity,
  })

  // 4b. Fetch Partner Deals Preset List
  const { data: partnerDeals = [], isLoading: isLoadingPartners } = useQuery<PartnerDeal[]>({
    queryKey: ['partnerDeals'],
    queryFn: async () => {
      return await getPartnerDeals()
    },
    staleTime: Infinity,
  })

  // 4c. Fetch Expense Categories
  const { data: expenseCategories = [], isLoading: isLoadingExpenseCategories } = useQuery<ExpenseCategory[]>({
    queryKey: ['expenseCategories'],
    queryFn: async () => {
      return await getExpenseCategories()
    },
    staleTime: Infinity,
  })

  // 4d. Fetch Expenses
  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => {
      return await getExpenses()
    },
    staleTime: Infinity,
  })

  // Subscribe to Supabase Realtime — patches bookings cache on INSERT/UPDATE/DELETE.
  // So a save does NOT read the bookings again afterwards: it used to, and every payment,
  // check-in or edit fetched every booking ever made and redrew the whole calendar, while
  // the row had already been put in place by the save itself and then by Realtime.
  useRealtimeBookings()

  // Realtime listeners for rooms & venues — invalidates price cache when DB changes
  useEffect(() => {
    const channel = supabase
      .channel('rooms-venues-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        queryClient.invalidateQueries({ queryKey: ['rooms'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venues' }, () => {
        queryClient.invalidateQueries({ queryKey: ['venues'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['payments'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  // 7. Mutation: Cancel Booking — the row stays, marked Cancelled, and the room is freed.
  // A date block is not a booking, so cancelling one simply removes it.
  const cancelBookingMutation = useMutation<void, Error, { bookingId: string; note?: string }, MutationContext>({
    mutationFn: async ({ bookingId, note }) => {
      const target = allBookings.find(b => b.id === bookingId)
      if (target?.status === 'blocked') await deleteBookingDb(bookingId)
      else {
        await cancelBookingDb(bookingId, note)
        if (target) await settleWithout(target)
      }
    },
    onMutate: async ({ bookingId, note }) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])
      queryClient.setQueryData<Booking[]>(['bookings'], old => old && attach(old.flatMap(b =>
        b.id !== bookingId ? [b]
          : b.status === 'blocked' ? []
            : [{ ...b, status: 'cancelled' as const, cancelled_at: new Date().toISOString(), cancel_note: note?.trim() || undefined }]
      )))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['bookings'], ctx?.previous)
    }
  })

  // 7b. Mutation: Delete Booking — for a row that should never have existed (a booking
  // whose save was rolled back), and for a finished stay the desk takes off from its panel
  // (2026-10-30). A stay that has not ended is cancelled, never deleted.
  const deleteBookingMutation = useMutation<void, Error, string, MutationContext>({
    mutationFn: async (bookingId: string) => {
      const target = allBookings.find(b => b.id === bookingId)
      await deleteBookingDb(bookingId)
      if (target) await settleWithout(target)
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])
      queryClient.setQueryData<Booking[]>(['bookings'], old => old && attach(old.filter(b => b.id !== bookingId)))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['bookings'], ctx?.previous)
    }
  })

  // 8. Mutation: Add Manual Block / Booking (Facebook, Google Maps, Walk-in, Admin Block)
  const createManualBookingMutation = useMutation<Booking, Error, {
    id?: string; invoiceNumber?: string
    roomId?: string; venueId?: string; guestName: string; guestEmail: string
    guestPhone: string; checkIn: string; checkOut: string
    source: BookingSource; status: 'confirmed' | 'blocked' | 'pending' | 'cancelled'
    breakfastOrders?: BreakfastOrder[]; equipmentRentals?: EquipmentRental
    eventAddons?: EventAddons; rateMultiplier?: number; companions?: Companion[]
    partnerDealId?: string; companyName?: string; institution?: string; vehiclePlate?: string
    paymentMethod?: string; paymentReference?: string; paymentPlan?: 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'; venueExcessHours?: number
    paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
    downpaymentPaid?: number; balanceDue?: number; securityDeposit?: number
    breakfastIncluded?: boolean; contractRateOverride?: number
    guestGender?: string; guestNationality?: string; guestAddress?: string; birthdate?: string
    appliedDiscount?: AppliedDiscount | AppliedDiscount[]
    earlyCheckInHours?: number; lateCheckOutHours?: number; venueDayBlocks?: number
    notes?: string; preparedBy?: string; breakfastDays?: string[]
    referenceNumber?: string; registeredOn?: string; paymentRecords?: PaymentRecord[]; agreedDeposit?: number
    /** Short stay (printed rate board): the hours the room was taken for. */
    stayHours?: number
    /** The half of the day a short stay was booked for: 0 the morning, 1 the afternoon. */
    stayHalf?: 0 | 1
    /** Ties the rooms of one booking together — the same value on each of them. */
    groupId?: string
    /** A paper booking whose stay is already over arrives checked in and out. */
    actualCheckIn?: string; actualCheckOut?: string
  }, MutationContext>({
    mutationFn: async (params) => {
      const { id, invoiceNumber, roomId, venueId, guestName, guestEmail, guestPhone, guestGender, guestNationality, guestAddress, birthdate, checkIn, checkOut,
        source, status, breakfastOrders, equipmentRentals, eventAddons,
        rateMultiplier, companions,
        partnerDealId, companyName, institution, vehiclePlate, breakfastIncluded, contractRateOverride,
        paymentMethod, paymentReference, paymentPlan, venueExcessHours = 0,
        paymentStatus, downpaymentPaid, balanceDue, securityDeposit,
        appliedDiscount, earlyCheckInHours, lateCheckOutHours, venueDayBlocks, notes, preparedBy, breakfastDays,
        referenceNumber, registeredOn, paymentRecords, agreedDeposit, stayHours, stayHalf, groupId, actualCheckIn, actualCheckOut } = params

      // A guest gone early no longer holds the nights they left, which may be sold now.
      const facts = { stay_hours: stayHours, stay_half: stayHalf, actual_check_out: id ? allBookings.find(b => b.id === id)?.actual_check_out : undefined }
      if (roomId && !isRoomAvailable(roomId, checkIn, checkOut, bookings, id, facts)) {
        throw new Error('The room is already booked or blocked for these dates.')
      }
      // `id` is the booking being corrected: without it a venue booking collided with
      // itself and could never be saved again.
      if (venueId && !isVenueRangeAvailable(venueId, checkIn, checkOut, bookings, id, facts)) {
        throw new Error('This venue is already reserved for the selected date(s).')
      }

      const pricing = calculatePricing({
        roomId, venueId, checkIn, checkOut, guestEmail,
        // A room's form sends no add-ons, and the saved ones are kept (below) — so they are
        // priced too, or a correction drops the charges written on the bill from the balance.
        equipmentRentals, eventAddons: eventAddons ?? (id ? allBookings.find(b => b.id === id)?.event_addons : undefined),
        bookingsList: bookings, rateMultiplier,
        contractRateOverride, venueExcessHours,
        rooms, venues,
        // Breakfast is the ROOM's own charge, once a night (2026-10-17), and the
        // booking stores that flag — so the price it is SAVED with has to carry it too.
        // Leaving it out priced every new booking as the room alone: GRF-2026-09-0014
        // (Room 6, breakfast ₱600) was stored owing ₱1,800 on a ₱2,400 stay, while the
        // printed bill — which does pass this — showed Sub-Total ₱2,400 and an Amount
        // Due of ₱1,800 copied from that short balance. A Deposit booking lost half of
        // it as well.
        breakfastIncluded,
        // The mornings chosen on the bill; a save that does not send them keeps the saved ones.
        breakfastDays: breakfastDays ?? (id ? allBookings.find(b => b.id === id)?.breakfast_days : undefined),
        appliedDiscount, earlyCheckInHours, lateCheckOutHours, venueDayBlocks,
        // A short stay must be priced for its hours, or the booking is stored owing a
        // whole night (see `docs/why/money.md`).
        shortStayHours: stayHours,
        rates: getRateConfig(),
      })

      const newBooking: Booking = {
        id: id || `manual-${randomUUID()}`,
        room_id: roomId,
        venue_id: venueId,
        guest_name: guestName || (status === 'blocked' ? 'Admin Date Block' : 'Walk-in Guest'),
        guest_email: guestEmail || 'admin@daweez-booking.vercel.app',
        guest_phone: guestPhone || 'None',
        guest_gender: guestGender || undefined,
        guest_nationality: guestNationality || undefined,
        guest_address: guestAddress || undefined,
        birthdate: birthdate || undefined,
        check_in: checkIn, check_out: checkOut,
        source, status,
        // ONE PRICE, and since 2026-09-29 there is no second figure to choose. The
        // column is kept and written `true`, because every booking IS priced at the single
        // figure — `promo_applied` no longer decides anything, it only records that fact for
        // a row saved before the collapse.
        promo_applied: true,
        payment_status: paymentStatus !== undefined ? paymentStatus : (status === 'blocked' ? undefined : 'unpaid'),
        downpayment_paid: downpaymentPaid !== undefined ? downpaymentPaid : 0,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        payment_plan: paymentPlan,
        venue_excess_hours: venueExcessHours,
        balance_due: balanceDue !== undefined ? balanceDue : (status === 'blocked' ? 0 : pricing.grandTotal),
        security_deposit: securityDeposit !== undefined ? securityDeposit : (status === 'blocked' ? 0 : pricing.securityDeposit),
        breakfast_orders: breakfastOrders, equipment_rentals: equipmentRentals,
        event_addons: eventAddons, companions,
        created_at: id ? (bookings.find(b => b.id === id)?.created_at || new Date().toISOString()) : new Date().toISOString(),
        expires_at: null,
        partner_deal_id: partnerDealId,
        company_name: companyName,
        institution,
        vehicle_plate: vehiclePlate,
        invoice_number: invoiceNumber,
        breakfast_included: !!breakfastIncluded,
        contract_rate_override: contractRateOverride,
        applied_discount: appliedDiscount,
        early_check_in_hours: earlyCheckInHours,
        late_check_out_hours: lateCheckOutHours,
        venue_day_blocks: venueDayBlocks,
        breakfast_days: breakfastDays,
        reference_number: referenceNumber,
        registered_on: registeredOn,
        payment_records: paymentRecords,
        notes,
        prepared_by: preparedBy,
        agreed_deposit: agreedDeposit,
        stay_hours: stayHours,
        stay_half: stayHours ? stayHalf : undefined,
        group_id: groupId,
        actual_check_in: actualCheckIn,
        actual_check_out: actualCheckOut,
      }

      if (id) {
        // Correcting a booking through the form: the form only knows the fields it
        // shows. Everything else the booking has collected since it was made — its
        // payments and receipts above all, the check-in and check-out times, the
        // breakfasts served — is carried over from the saved booking. Sent blank,
        // those were written over as empty: one correction to a guest's name wiped
        // every receipt on the booking (found 2026-10-03).
        const saved = allBookings.find(b => b.id === id)
        // A room that joins (or already belongs to) a several-room booking carries its mark.
        const group = groupId ?? saved?.group_id
        if (group && group !== saved?.group_id) await setBookingGroup(id, group)
        const updated = await updateBookingDb(saved ? {
          ...newBooking,
          payment_records: newBooking.payment_records ?? saved.payment_records,
          breakfast_orders: newBooking.breakfast_orders ?? saved.breakfast_orders,
          breakfast_days: newBooking.breakfast_days ?? saved.breakfast_days,
          breakfast_records: saved.breakfast_records,
          event_addons: newBooking.event_addons ?? saved.event_addons,
          reference_number: newBooking.reference_number ?? saved.reference_number,
          registered_on: newBooking.registered_on ?? saved.registered_on,
          early_check_in_hours: newBooking.early_check_in_hours ?? saved.early_check_in_hours,
          late_check_out_hours: newBooking.late_check_out_hours ?? saved.late_check_out_hours,
          actual_check_in: saved.actual_check_in,
          actual_check_out: saved.actual_check_out,
          invoice_type: saved.invoice_type,
          stay_hours: newBooking.stay_hours ?? saved.stay_hours,
          stay_half: newBooking.stay_half ?? saved.stay_half,
        } : newBooking)
        const moved = saved ? await noteMove(saved, newBooking.check_in) : undefined
        return { ...updated, group_id: group, moved_from: moved }
      }
      return await insertBooking(newBooking)
    },
    onMutate: async (params) => {
      // Freeze the poll so an in-flight refetch can't race the optimistic update
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])

      // Push a lightweight optimistic booking into the cache immediately
      const optimistic: Booking = {
        id: '__optimistic__' + Date.now(),
        room_id: params.roomId, venue_id: params.venueId,
        guest_name: params.guestName || (params.status === 'blocked' ? 'Admin Date Block' : 'Walk-in Guest'),
        guest_email: params.guestEmail || 'admin@daweez-booking.vercel.app',
        guest_phone: params.guestPhone || 'None',
        check_in: params.checkIn, check_out: params.checkOut,
        source: params.source, status: params.status,
        downpayment_paid: 0, balance_due: 0, security_deposit: 0,
        created_at: new Date().toISOString(),
        expires_at: null,
        partner_deal_id: params.partnerDealId,
        company_name: params.companyName,
        vehicle_plate: params.vehiclePlate,
        invoice_number: undefined,
        breakfast_included: !!params.breakfastIncluded,
        contract_rate_override: params.contractRateOverride
      }
      queryClient.setQueryData<Booking[]>(['bookings'], old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      // Roll back cache on failure
      queryClient.setQueryData(['bookings'], ctx?.previous)
    },
    onSuccess: (newBooking) => {
      // Swap the optimistic placeholder with the real booking — still no refetch
      queryClient.setQueryData<Booking[]>(['bookings'], old =>
        attach(old ? [...old.filter(b => !b.id.startsWith('__optimistic__') && b.id !== newBooking.id), newBooking] : [newBooking])
      )
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    }
  })

  // 9. Mutation: Update Booking
  const updateBookingMutation = useMutation<void, Error, Booking, MutationContext>({
    mutationFn: async (updatedBooking: Booking) => {
      // **The collision check belongs to a MOVE, not to a write** (the owner's bug report,
      // 2026-09-29: *"Overlap collision — room already reserved"* on every paid booking,
      // while a Reservation saved fine).
      //
      // Recording the money updates the booking without touching its room or its dates, so
      // there is no overlap it could possibly create — and running the check anyway made the
      // booking collide with ITSELF. A booking created moments earlier is still in the list
      // this closure holds as the form's `__optimistic__` placeholder, whose id is not the id
      // being saved, so `skipBookingId` never matched it and its own room and dates came back
      // as a clash. A Reservation was unaffected because it takes no money and never reaches
      // this mutation at all.
      //
      // So the check now runs **only when the unit or the dates actually changed**, and never
      // when the row cannot be found in the list we are holding (a list that does not contain
      // the row proves nothing either way — that stale list is the other half of the same
      // bug). **The database still enforces the rule on every write**: `update_booking` raises
      // ROOM_UNAVAILABLE for a real overlap and `utils/db.ts` reports it, so nothing is left
      // unguarded — the client check is the early warning, the RPC is the gate.
      const before = bookings.find(b => b.id === updatedBooking.id)
      const moved = !!before && (
        before.room_id !== updatedBooking.room_id ||
        before.venue_id !== updatedBooking.venue_id ||
        before.check_in !== updatedBooking.check_in ||
        before.check_out !== updatedBooking.check_out
      )
      if (moved && updatedBooking.room_id && !isRoomAvailable(updatedBooking.room_id, updatedBooking.check_in, updatedBooking.check_out, bookings, updatedBooking.id, updatedBooking)) {
        throw new Error('Overlap collision — room already reserved.')
      }
      if (moved && updatedBooking.venue_id && !isVenueRangeAvailable(updatedBooking.venue_id, updatedBooking.check_in, updatedBooking.check_out, bookings, updatedBooking.id, updatedBooking)) {
        throw new Error('Overlap collision — venue already reserved.')
      }
      await updateBookingDb(updatedBooking)
    },
    onMutate: async (updatedBooking) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])
      const pays = queryClient.getQueryData<PaymentRow[]>(['payments'])
      // The bill's leading room carries its payments: what it is saved with is the bill's, at once.
      const list = (previous || []).map(b => b.id === updatedBooking.id ? updatedBooking : b)
      if (pays && billLeads(list).get(billKey(updatedBooking)) === updatedBooking.id) {
        queryClient.setQueryData<PaymentRow[]>(['payments'], withBillPayments(pays, updatedBooking))
      }
      queryClient.setQueryData<Booking[]>(['bookings'], previous && attach(list))
      return { previous, pays }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['bookings'], ctx?.previous)
      if (ctx?.pays) queryClient.setQueryData(['payments'], ctx.pays)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    }
  })

  // A room leaves its bill (cancelled, or a finished stay taken off): the payments stay with the bill
  // (`utils/payments.ts`), its discounts go onto the room that leads now, and the bill is priced again
  // there — or what it still owes stayed on the room that left (Sebastian, 2026-11-09).
  async function settleWithout(gone: Booking) {
    if (gone.status === 'blocked') return
    const rest = groupOf(gone, allBookings).filter(b => b.id !== gone.id && b.status !== 'cancelled')
    if (rest.length === 0) return
    const moved = onLead([...rest, gone]).slice(0, rest.length)
    const after = await resettle(moved, { rooms, venues })
    for (const r of changedRows(rest, after)) await updateBookingMutation.mutateAsync(r)
  }

  // 9. Mutation: ask the booking sites' calendar links for new stays now. Nothing is read
  // again afterwards: what it adds reaches the calendar through Realtime.
  const triggerOTASyncMutation = useMutation({ mutationFn: runCalendarSync })

  // 10. Mutation: Update Room iCal Feeds URLs
  const updateFeedUrlsMutation = useMutation({
    mutationFn: async (updatedFeeds: SyncFeed[]) => {
      await saveFeeds(updatedFeeds)
      return updatedFeeds
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
    }
  })

  // 10b2. Mutation: Update a room's breakfast price (card k140) — charged once a night.
  const updateRoomBreakfastMutation = useMutation({
    mutationFn: async (params: { roomId: string; price: number }) => {
      return await updateRoomBreakfastPriceDb(params.roomId, params.price)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    }
  })

  // 10b. Mutation: Update a room's Rates (Regular + Promo). Used by Settings → Rates.
  const updateRoomRateMutation = useMutation({
    mutationFn: async (params: { roomId: string; basePrice: number; promoPrice?: number | null }) => {
      return await updateRoomRateDb(params.roomId, params.basePrice, params.promoPrice)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    }
  })

  // 10b3. Mutation: Update a room's short-stay prices — 3, 6 and 12 hours, from the
  // printed rate board. Zero in a box means the room is not sold for those hours.
  const updateRoomHourPricesMutation = useMutation({
    mutationFn: async (params: { roomId: string; hour3: number; hour6: number; hour12: number }) => {
      return await updateRoomHourPricesDb(params.roomId, params.hour3, params.hour6, params.hour12)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    }
  })

  // 11. Mutation: Create Partner Deal
  const createPartnerDealMutation = useMutation({
    mutationFn: async (deal: PartnerDeal) => {
      await insertPartnerDeal(deal)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerDeals'] })
    }
  })

  // 12. Mutation: Save Partner Deals
  const savePartnerDealsMutation = useMutation({
    mutationFn: async (deals: PartnerDeal[]) => {
      await savePartnerDealsDb(deals)
    },
    // A price changed on a bill is the agency's at once (2026-11-05): the bill reads the agency
    // from this cache, so it is laid over first and taken back if the save fails.
    onMutate: async (deals: PartnerDeal[]) => {
      await queryClient.cancelQueries({ queryKey: ['partnerDeals'] })
      const before = queryClient.getQueryData<PartnerDeal[]>(['partnerDeals'])
      queryClient.setQueryData<PartnerDeal[]>(['partnerDeals'], old => (old || []).map(d => deals.find(x => x.id === d.id) || d))
      return { before }
    },
    onError: (_e, _d, ctx) => {
      if (ctx?.before) queryClient.setQueryData(['partnerDeals'], ctx.before)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerDeals'] })
    }
  })

  // 13. Mutation: Delete Partner Deal
  const deletePartnerDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      await deletePartnerDealDb(dealId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerDeals'] })
    }
  })

  // 14. Mutation: Create Expense Category
  const createExpenseCategoryMutation = useMutation({
    mutationFn: async (category: Omit<ExpenseCategory, 'created_at'> & { created_at?: string }) => {
      await insertExpenseCategory(category)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })
    }
  })

  // 15. Mutation: Update Expense Category
  const updateExpenseCategoryMutation = useMutation({
    mutationFn: async (category: ExpenseCategory) => {
      await updateExpenseCategoryDb(category)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })
    }
  })

  // 16. Mutation: Delete Expense Category
  const deleteExpenseCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await deleteExpenseCategoryDb(categoryId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })
    }
  })

  // 17. Mutation: Create Expense
  const createExpenseMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, 'created_at'> & { created_at?: string }) => {
      await insertExpense(expense)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  // 18. Mutation: Delete Expense
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await deleteExpenseDb(expenseId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  // The same functions every render, so the screens' shared data is not rebuilt for nothing.
  const rateAsync = updateRoomRateMutation.mutateAsync
  const breakfastAsync = updateRoomBreakfastMutation.mutateAsync
  const hoursAsync = updateRoomHourPricesMutation.mutateAsync
  const updateRoomRate = useCallback((roomId: string, basePrice: number, promoPrice?: number | null) =>
    rateAsync({ roomId, basePrice, promoPrice }), [rateAsync])
  // A price typed on the spot (the booking form, the calendar's short-stay hours) is on the
  // room at once and saved behind it, so the form that opens next already charges it; a failed
  // save puts the old figures back (the price-on-the-spot mock Sebastian approved, 2026-10-16).
  const patchRoom = useCallback(async (roomId: string, patch: Partial<Room>, save: () => Promise<unknown>) => {
    const before = queryClient.getQueryData<Room[]>(['rooms'])
    queryClient.setQueryData<Room[]>(['rooms'], list => list?.map(r => r.id === roomId ? { ...r, ...patch } : r))
    try {
      await save()
    } catch (e) {
      queryClient.setQueryData(['rooms'], before)
      throw e
    }
  }, [queryClient])
  const updateRoomBreakfastPrice = useCallback((roomId: string, price: number) =>
    patchRoom(roomId, { breakfast_price: price }, () => breakfastAsync({ roomId, price })), [patchRoom, breakfastAsync])
  const updateRoomHourPrices = useCallback((roomId: string, hour3: number, hour6: number, hour12: number) =>
    patchRoom(roomId, { hour3_price: hour3, hour6_price: hour6, hour12_price: hour12 }, () => hoursAsync({ roomId, hour3, hour6, hour12 })), [patchRoom, hoursAsync])

  return {
    rooms,
    venues,
    bookings,
    allBookings,
    feeds,
    partnerDeals,
    expenseCategories,
    expenses,
    isLoading: isLoadingRooms || isLoadingVenues || isLoadingBookings || isLoadingPayments || isLoadingFeeds || isLoadingPartners || isLoadingExpenseCategories || isLoadingExpenses,

    // Mutations
    cancelBooking: (bookingId: string, note?: string) => cancelBookingMutation.mutateAsync({ bookingId, note }),
    deleteBooking: deleteBookingMutation.mutateAsync,
    isCancellingBooking: cancelBookingMutation.isPending,

    createManualBooking: createManualBookingMutation.mutateAsync,
    isCreatingManualBooking: createManualBookingMutation.isPending,

    updateBooking: updateBookingMutation.mutateAsync,
    isUpdatingBooking: updateBookingMutation.isPending,

    triggerOTASync: triggerOTASyncMutation.mutateAsync,

    updateFeedUrls: updateFeedUrlsMutation.mutateAsync,

    updateRoomRate,
    isUpdatingRoomRate: updateRoomRateMutation.isPending,

    updateRoomBreakfastPrice,

    updateRoomHourPrices,

    createPartnerDeal: createPartnerDealMutation.mutateAsync,
    savePartnerDeals: savePartnerDealsMutation.mutateAsync,
    deletePartnerDeal: deletePartnerDealMutation.mutateAsync,

    createExpenseCategory: createExpenseCategoryMutation.mutateAsync,
    updateExpenseCategory: updateExpenseCategoryMutation.mutateAsync,
    deleteExpenseCategory: deleteExpenseCategoryMutation.mutateAsync,
    createExpense: createExpenseMutation.mutateAsync,
    deleteExpense: deleteExpenseMutation.mutateAsync
  }
}
