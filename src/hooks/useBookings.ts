import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as syncEngine from '../utils/syncEngine'
import { Booking, Room, Venue, SyncFeed, BookingSource, BreakfastOrder, EquipmentRental, EventAddons, Companion, PartnerDeal } from '../types/booking'
import { Expense, ExpenseCategory } from '../types/expense'
import { useRealtimeBookings } from './useRealtimeBookings'

type MutationContext = { previous: Booking[] | undefined }

export function useBookings() {
  const queryClient = useQueryClient()

  // 1. Fetch Rooms List (Now async from Supabase/local)
  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      return await syncEngine.DEFAULT_ROOMS // Prepopulated list matches DB varchar ids perfectly
    },
    staleTime: Infinity,
  })

  // 2. Fetch Venues List
  const { data: venues = [], isLoading: isLoadingVenues } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: async () => {
      return syncEngine.DEFAULT_VENUES
    },
    staleTime: Infinity,
  })

  // 3. Fetch Bookings (initial load only — Realtime subscription keeps cache fresh)
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      return await syncEngine.getBookings()
    },
    staleTime: Infinity, // Realtime handles freshness; don't re-fetch on focus/mount
  })

  // 4. Fetch iCal Feeds
  const { data: feeds = [], isLoading: isLoadingFeeds } = useQuery<SyncFeed[]>({
    queryKey: ['feeds'],
    queryFn: async () => {
      return await syncEngine.getFeeds()
    },
    staleTime: Infinity,
  })

  // 4b. Fetch Partner Deals Preset List
  const { data: partnerDeals = [], isLoading: isLoadingPartners } = useQuery<PartnerDeal[]>({
    queryKey: ['partnerDeals'],
    queryFn: async () => {
      return await syncEngine.getPartnerDeals()
    },
    staleTime: Infinity,
  })

  // 4c. Fetch Expense Categories
  const { data: expenseCategories = [], isLoading: isLoadingExpenseCategories } = useQuery<ExpenseCategory[]>({
    queryKey: ['expenseCategories'],
    queryFn: async () => {
      return await syncEngine.getExpenseCategories()
    },
    staleTime: Infinity,
  })

  // 4d. Fetch Expenses
  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => {
      return await syncEngine.getExpenses()
    },
    staleTime: Infinity,
  })

  // Subscribe to Supabase Realtime — patches cache on INSERT/UPDATE/DELETE, no polling needed
  useRealtimeBookings()

  // 5. Mutation: Create Web Booking (30-Minute Lock with downpayments + breakfast/rentals)
  const createPendingBookingMutation = useMutation<Booking, Error, {
    roomId?: string; venueId?: string; guestName: string; guestEmail: string
    guestPhone: string; checkIn: string; checkOut: string
    breakfastOrders?: BreakfastOrder[]; equipmentRentals?: EquipmentRental; eventAddons?: EventAddons
  }, MutationContext>({
    mutationFn: async (params) => {
      const { roomId, venueId, guestName, guestEmail, guestPhone, checkIn, checkOut, breakfastOrders, equipmentRentals, eventAddons } = params

      if (roomId && !syncEngine.isRoomAvailable(roomId, checkIn, checkOut, bookings)) {
        throw new Error('This room is no longer available for the selected dates.')
      }
      if (venueId && !syncEngine.isVenueRangeAvailable(venueId, checkIn, checkOut, bookings)) {
        throw new Error('This event venue is already reserved for the selected date(s).')
      }

      const pricing = syncEngine.calculatePricing({
        roomId, venueId, checkIn, checkOut, guestEmail,
        breakfastOrders, equipmentRentals, eventAddons, bookingsList: bookings
      })

      const now = new Date()
      const newBooking: Booking = {
        id: (roomId ? 'web-rm-' : 'web-vn-') + syncEngine.generateUUID(),
        room_id: roomId, venue_id: venueId,
        guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone,
        check_in: checkIn, check_out: checkOut,
        source: 'website', status: 'pending',
        downpayment_paid: pricing.downpayment,
        balance_due: pricing.balanceDue,
        security_deposit: pricing.securityDeposit,
        breakfast_orders: breakfastOrders, equipment_rentals: equipmentRentals, event_addons: eventAddons,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 30 * 60000).toISOString()
      }

      await syncEngine.insertBooking(newBooking)
      return newBooking
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])
      // Build a lightweight optimistic booking to show immediately
      const optimistic: Booking = {
        id: '__optimistic__' + Date.now(),
        room_id: params.roomId, venue_id: params.venueId,
        guest_name: params.guestName, guest_email: params.guestEmail, guest_phone: params.guestPhone,
        check_in: params.checkIn, check_out: params.checkOut,
        source: 'website', status: 'pending',
        downpayment_paid: 0, balance_due: 0, security_deposit: 0,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60000).toISOString()
      }
      queryClient.setQueryData<Booking[]>(['bookings'], old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['bookings'], ctx?.previous)
    },
    onSuccess: (newBooking) => {
      // Replace optimistic entry with real booking, no network refetch needed
      queryClient.setQueryData<Booking[]>(['bookings'], old =>
        old ? [...old.filter(b => !b.id.startsWith('__optimistic__')), newBooking] : [newBooking]
      )
    }
  })

  // 6. Mutation: Confirm Pending Booking (Permanent Block)
  const confirmBookingMutation = useMutation<void, Error, string, MutationContext>({
    mutationFn: async (bookingId: string) => {
      const current = await syncEngine.getBookings()
      const updated = current.map(b =>
        b.id === bookingId ? { ...b, status: 'confirmed' as const, expires_at: null } : b
      )
      await syncEngine.saveBookings(updated)
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])
      queryClient.setQueryData<Booking[]>(['bookings'], old =>
        old?.map(b => b.id === bookingId ? { ...b, status: 'confirmed' as const, expires_at: null } : b)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['bookings'], ctx?.previous)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })

  // 7. Mutation: Delete/Cancel Booking
  const cancelBookingMutation = useMutation<void, Error, string, MutationContext>({
    mutationFn: async (bookingId: string) => {
      await syncEngine.deleteBooking(bookingId)
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previous = queryClient.getQueryData<Booking[]>(['bookings'])
      queryClient.setQueryData<Booking[]>(['bookings'], old => old?.filter(b => b.id !== bookingId))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['bookings'], ctx?.previous)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })

  // 8. Mutation: Add Manual Block / Booking (Facebook, Google Maps, Walk-in, Admin Block)
  const createManualBookingMutation = useMutation<Booking, Error, {
    roomId?: string; venueId?: string; guestName: string; guestEmail: string
    guestPhone: string; checkIn: string; checkOut: string
    source: BookingSource; status: 'confirmed' | 'blocked'
    breakfastOrders?: BreakfastOrder[]; equipmentRentals?: EquipmentRental
    eventAddons?: EventAddons; rateMultiplier?: number; companions?: Companion[]
    partnerDealId?: string; companyName?: string; vehiclePlate?: string
    invoiceType?: 'folio' | 'billing'; breakfastIncluded?: boolean; contractRateOverride?: number
    paymentMethod?: string; paymentReference?: string; venueExcessHours?: number
  }, MutationContext>({
    mutationFn: async (params) => {
      const { roomId, venueId, guestName, guestEmail, guestPhone, checkIn, checkOut,
        source, status, breakfastOrders, equipmentRentals, eventAddons,
        rateMultiplier = 1.0, companions,
        partnerDealId, companyName, vehiclePlate, invoiceType, breakfastIncluded, contractRateOverride,
        paymentMethod, paymentReference, venueExcessHours = 0 } = params

      if (roomId && !syncEngine.isRoomAvailable(roomId, checkIn, checkOut, bookings)) {
        throw new Error('The room is already booked or blocked for these dates.')
      }
      if (venueId && !syncEngine.isVenueRangeAvailable(venueId, checkIn, checkOut, bookings)) {
        throw new Error('This venue is already reserved for the selected date(s).')
      }

      const pricing = syncEngine.calculatePricing({
        roomId, venueId, checkIn, checkOut, guestEmail,
        breakfastOrders, equipmentRentals, eventAddons,
        bookingsList: bookings, rateMultiplier, companions,
        contractRateOverride, venueExcessHours
      })

      const newBooking: Booking = {
        id: `manual-${syncEngine.generateUUID()}`,
        room_id: roomId,
        venue_id: venueId,
        guest_name: guestName || (status === 'blocked' ? 'Admin Date Block' : 'Walk-in Guest'),
        guest_email: guestEmail || 'admin@daweez-booking.vercel.app',
        guest_phone: guestPhone || 'None',
        check_in: checkIn, check_out: checkOut,
        source, status,
        downpayment_paid: status === 'blocked' ? 0 : pricing.downpayment,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        venue_excess_hours: venueExcessHours,
        balance_due: status === 'blocked' ? 0 : pricing.balanceDue,
        security_deposit: status === 'blocked' ? 0 : pricing.securityDeposit,
        breakfast_orders: breakfastOrders, equipment_rentals: equipmentRentals,
        event_addons: eventAddons, companions,
        created_at: new Date().toISOString(),
        expires_at: null,
        partner_deal_id: partnerDealId,
        company_name: companyName,
        vehicle_plate: vehiclePlate,
        invoice_type: invoiceType,
        breakfast_included: !!breakfastIncluded,
        contract_rate_override: contractRateOverride
      }

      // Single INSERT — no read+upsert-all round-trip
      await syncEngine.insertBooking(newBooking)
      return newBooking
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
        invoice_type: params.invoiceType,
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
        old ? [...old.filter(b => !b.id.startsWith('__optimistic__')), newBooking] : [newBooking]
      )
    }
  })

  // 9. Mutation: Trigger Simulated OTA Feed Sync
  const triggerOTASyncMutation = useMutation({
    mutationFn: async () => {
      const currentBookings = queryClient.getQueryData<Booking[]>(['bookings']) || []
      const currentFeeds = queryClient.getQueryData<SyncFeed[]>(['feeds']) || []
      return await syncEngine.runSimulatedOTASync(currentBookings, currentFeeds)
    },
    onSuccess: () => {
      // Bookings are kept fresh by Realtime — only feeds need a refetch
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
    }
  })

  // 10. Mutation: Update Room iCal Feeds URLs
  const updateFeedUrlsMutation = useMutation({
    mutationFn: async (updatedFeeds: SyncFeed[]) => {
      await syncEngine.saveFeeds(updatedFeeds)
      return updatedFeeds
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
    }
  })

  // 11. Mutation: Create Partner Deal
  const createPartnerDealMutation = useMutation({
    mutationFn: async (deal: PartnerDeal) => {
      await syncEngine.insertPartnerDeal(deal)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerDeals'] })
    }
  })

  // 12. Mutation: Save Partner Deals
  const savePartnerDealsMutation = useMutation({
    mutationFn: async (deals: PartnerDeal[]) => {
      await syncEngine.savePartnerDeals(deals)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerDeals'] })
    }
  })

  // 13. Mutation: Delete Partner Deal
  const deletePartnerDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      await syncEngine.deletePartnerDeal(dealId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerDeals'] })
    }
  })

  // 14. Mutation: Create Expense Category
  const createExpenseCategoryMutation = useMutation({
    mutationFn: async (category: Omit<ExpenseCategory, 'created_at'> & { created_at?: string }) => {
      await syncEngine.insertExpenseCategory(category)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })
    }
  })

  // 15. Mutation: Update Expense Category
  const updateExpenseCategoryMutation = useMutation({
    mutationFn: async (category: ExpenseCategory) => {
      await syncEngine.updateExpenseCategory(category)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })
    }
  })

  // 16. Mutation: Delete Expense Category
  const deleteExpenseCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await syncEngine.deleteExpenseCategory(categoryId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })
    }
  })

  // 17. Mutation: Create Expense
  const createExpenseMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, 'created_at'> & { created_at?: string }) => {
      await syncEngine.insertExpense(expense)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  // 18. Mutation: Delete Expense
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await syncEngine.deleteExpense(expenseId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  return {
    rooms,
    venues,
    bookings,
    feeds,
    partnerDeals,
    expenseCategories,
    expenses,
    isLoading: isLoadingRooms || isLoadingVenues || isLoadingBookings || isLoadingFeeds || isLoadingPartners || isLoadingExpenseCategories || isLoadingExpenses,

    // Mutations
    createPendingBooking: createPendingBookingMutation.mutateAsync,
    isCreatingPendingBooking: createPendingBookingMutation.isPending,

    confirmBooking: confirmBookingMutation.mutateAsync,
    isConfirmingBooking: confirmBookingMutation.isPending,

    cancelBooking: cancelBookingMutation.mutateAsync,
    isCancellingBooking: cancelBookingMutation.isPending,

    createManualBooking: createManualBookingMutation.mutateAsync,
    isCreatingManualBooking: createManualBookingMutation.isPending,

    triggerOTASync: triggerOTASyncMutation.mutateAsync,
    isSyncingOTA: triggerOTASyncMutation.isPending,

    updateFeedUrls: updateFeedUrlsMutation.mutateAsync,
    isUpdatingFeeds: updateFeedUrlsMutation.isPending,

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
