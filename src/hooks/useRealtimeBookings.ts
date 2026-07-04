import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient'
import { Booking } from '../types/booking'
import { BookingSource, BookingStatus } from '../types/booking'

/** Map a raw Supabase row to the app's Booking shape */
function rowToBooking(b: Record<string, unknown>): Booking {
  return {
    id: b.id as string,
    room_id: (b.room_id as string) || undefined,
    venue_id: (b.venue_id as string) || undefined,
    guest_name: b.guest_name as string,
    guest_email: b.guest_email as string,
    guest_phone: b.guest_phone as string,
    check_in: b.check_in as string,
    check_out: b.check_out as string,
    source: b.source as BookingSource,
    status: b.status as BookingStatus,
    downpayment_paid: Number(b.downpayment_paid || 0),
    balance_due: Number(b.balance_due || 0),
    security_deposit: Number(b.security_deposit || 0),
    breakfast_orders: (b.breakfast_orders as Booking['breakfast_orders']) || undefined,
    equipment_rentals: (b.equipment_rentals as Booking['equipment_rentals']) || undefined,
    event_addons: (b.event_addons as Booking['event_addons']) || undefined,
    companions: (b.companions as Booking['companions']) || undefined,
    created_at: b.created_at as string,
    expires_at: (b.expires_at as string) || null,
  }
}

/**
 * Subscribes to Supabase Realtime for the `bookings` table.
 * On any INSERT / UPDATE / DELETE event, patches the TanStack Query cache
 * in-place — zero network round-trips.
 *
 * No-ops when Supabase is not configured (localStorage mode).
 */
export function useRealtimeBookings() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload

          queryClient.setQueryData<Booking[]>(['bookings'], (prev = []) => {
            // Remove optimistic placeholders so the real row replaces them cleanly
            const withoutOptimistic = prev.filter(b => !b.id.startsWith('__optimistic__'))

            if (eventType === 'INSERT') {
              const inserted = rowToBooking(newRow as Record<string, unknown>)
              // Guard: don't duplicate if already in cache (e.g. from onSuccess)
              if (withoutOptimistic.some(b => b.id === inserted.id)) return withoutOptimistic
              return [...withoutOptimistic, inserted]
            }

            if (eventType === 'UPDATE') {
              const updated = rowToBooking(newRow as Record<string, unknown>)
              return withoutOptimistic.map(b => b.id === updated.id ? updated : b)
            }

            if (eventType === 'DELETE') {
              const deletedId = (oldRow as Record<string, unknown>).id as string
              return withoutOptimistic.filter(b => b.id !== deletedId)
            }

            return withoutOptimistic
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
