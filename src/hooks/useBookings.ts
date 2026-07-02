import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as syncEngine from '../utils/syncEngine'
import { Booking, Room, Venue, SyncFeed, BookingSource, BreakfastOrder, EquipmentRental, EventAddons } from '../types/booking'

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

  // 3. Fetch Bookings List (Async queries from Supabase/local)
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      return await syncEngine.getBookings()
    },
    refetchInterval: 5000, // Poll every 5s for active 30-min lock countdowns & OTA syncs
  })

  // 4. Fetch iCal Feeds
  const { data: feeds = [], isLoading: isLoadingFeeds } = useQuery<SyncFeed[]>({
    queryKey: ['feeds'],
    queryFn: async () => {
      return await syncEngine.getFeeds()
    }
  })

  // 5. Mutation: Create Web Booking (30-Minute Lock with downpayments + breakfast/rentals)
  const createPendingBookingMutation = useMutation({
    mutationFn: async (params: {
      roomId?: string
      venueId?: string
      guestName: string
      guestEmail: string
      guestPhone: string
      checkIn: string
      checkOut: string
      breakfastOrders?: BreakfastOrder[]
      equipmentRentals?: EquipmentRental
      eventAddons?: EventAddons
    }) => {
      const { roomId, venueId, guestName, guestEmail, guestPhone, checkIn, checkOut, breakfastOrders, equipmentRentals, eventAddons } = params
      
      // Safety guard check
      if (roomId && !syncEngine.isRoomAvailable(roomId, checkIn, checkOut, bookings)) {
        throw new Error('This room is no longer available for the selected dates.')
      }

      if (venueId && !syncEngine.isVenueAvailable(venueId, checkIn, bookings)) {
        throw new Error('This event venue is already reserved for the selected date.')
      }

      // Calculate localized downpayments & deposit pricing
      const pricing = syncEngine.calculatePricing({
        roomId,
        venueId,
        checkIn,
        checkOut,
        guestEmail,
        breakfastOrders,
        equipmentRentals,
        eventAddons,
        bookingsList: bookings
      })

      const now = new Date()
      const expires = new Date(now.getTime() + 30 * 60000) // Lock for 30 minutes

      const newBooking: Booking = {
        id: (roomId ? 'web-rm-' : 'web-vn-') + syncEngine.generateUUID(),
        room_id: roomId,
        venue_id: venueId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        check_in: checkIn,
        check_out: checkOut,
        source: 'website',
        status: 'pending',
        downpayment_paid: pricing.downpayment,
        balance_due: pricing.balanceDue,
        security_deposit: pricing.securityDeposit,
        breakfast_orders: breakfastOrders,
        equipment_rentals: equipmentRentals,
        event_addons: eventAddons,
        created_at: now.toISOString(),
        expires_at: expires.toISOString()
      }

      const current = await syncEngine.getBookings()
      await syncEngine.saveBookings([...current, newBooking])
      return newBooking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })

  // 6. Mutation: Confirm Pending Booking (Permanent Block)
  const confirmBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const current = await syncEngine.getBookings()
      const updated = current.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            status: 'confirmed' as const,
            expires_at: null // Remove the 30-min expiration threshold
          }
        }
        return b
      })
      await syncEngine.saveBookings(updated)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })

  // 7. Mutation: Delete/Cancel Booking
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const current = await syncEngine.getBookings()
      const filtered = current.filter(b => b.id !== bookingId)
      await syncEngine.saveBookings(filtered)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })

  // 8. Mutation: Add Manual Block / Booking (Facebook, Google Maps, Walk-in, Admin Block)
  const createManualBookingMutation = useMutation({
    mutationFn: async (params: {
      roomId?: string
      venueId?: string
      guestName: string
      guestEmail: string
      guestPhone: string
      checkIn: string
      checkOut: string
      source: BookingSource
      status: 'confirmed' | 'blocked'
      breakfastOrders?: BreakfastOrder[]
      equipmentRentals?: EquipmentRental
      eventAddons?: EventAddons
      rateMultiplier?: number
    }) => {
      const { roomId, venueId, guestName, guestEmail, guestPhone, checkIn, checkOut, source, status, breakfastOrders, equipmentRentals, eventAddons, rateMultiplier = 1.0 } = params

      if (roomId && !syncEngine.isRoomAvailable(roomId, checkIn, checkOut, bookings)) {
        throw new Error('The room is already booked or blocked for these dates.')
      }

      if (venueId && !syncEngine.isVenueAvailable(venueId, checkIn, bookings)) {
        throw new Error('This venue is already reserved for the selected date.')
      }

      // Calculate localized downpayments & deposit pricing
      const pricing = syncEngine.calculatePricing({
        roomId,
        venueId,
        checkIn,
        checkOut,
        guestEmail,
        breakfastOrders,
        equipmentRentals,
        eventAddons,
        bookingsList: bookings,
        rateMultiplier
      })

      const newBooking: Booking = {
        id: `manual-${syncEngine.generateUUID()}`,
        room_id: roomId,
        venue_id: venueId,
        guest_name: guestName || (status === 'blocked' ? 'Admin Date Block' : 'Walk-in Guest'),
        guest_email: guestEmail || 'admin@daweez-booking.vercel.app',
        guest_phone: guestPhone || 'None',
        check_in: checkIn,
        check_out: checkOut,
        source,
        status,
        downpayment_paid: status === 'blocked' ? 0 : pricing.downpayment,
        balance_due: status === 'blocked' ? 0 : pricing.balanceDue,
        security_deposit: status === 'blocked' ? 0 : pricing.securityDeposit,
        breakfast_orders: breakfastOrders,
        equipment_rentals: equipmentRentals,
        event_addons: eventAddons,
        created_at: new Date().toISOString(),
        expires_at: null
      }

      const current = await syncEngine.getBookings()
      await syncEngine.saveBookings([...current, newBooking])
      return newBooking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
  })

  // 9. Mutation: Trigger Simulated OTA Feed Sync
  const triggerOTASyncMutation = useMutation({
    mutationFn: async () => {
      return await syncEngine.runSimulatedOTASync()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
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

  return {
    rooms,
    venues,
    bookings,
    feeds,
    isLoading: isLoadingRooms || isLoadingVenues || isLoadingBookings || isLoadingFeeds,
    
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
    isUpdatingFeeds: updateFeedUrlsMutation.isPending
  }
}
