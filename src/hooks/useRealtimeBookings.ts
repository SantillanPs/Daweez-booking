import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient'
import { Booking } from '../types/booking'
import { BookingSource, BookingStatus } from '../types/booking'

/** Map a raw Supabase row to the app's Booking shape (ALL columns, so live
 *  UPDATE events never strip fields from the cache). */
function rowToBooking(b: Record<string, unknown>): Booking {
  return {
    id: b.id as string,
    room_id: (b.room_id as string) || undefined,
    venue_id: (b.venue_id as string) || undefined,
    guest_name: b.guest_name as string,
    guest_email: b.guest_email as string,
    guest_phone: b.guest_phone as string,
    guest_gender: (b.guest_gender as string) || undefined,
    guest_nationality: (b.guest_nationality as string) || undefined,
    guest_address: (b.guest_address as string) || undefined,
    check_in: b.check_in as string,
    check_out: b.check_out as string,
    source: b.source as BookingSource,
    status: b.status as BookingStatus,
    payment_status: (b.payment_status as Booking['payment_status']) || undefined,
    promo_applied: (b.promo_applied as boolean) || undefined,
    payment_method: (b.payment_method as string) || undefined,
    payment_reference: (b.payment_reference as string) || undefined,
    downpayment_paid: Number(b.downpayment_paid || 0),
    balance_due: Number(b.balance_due || 0),
    security_deposit: Number(b.security_deposit || 0),
    breakfast_orders: (b.breakfast_orders as Booking['breakfast_orders']) || undefined,
    equipment_rentals: (b.equipment_rentals as Booking['equipment_rentals']) || undefined,
    event_addons: (b.event_addons as Booking['event_addons']) || undefined,
    companions: (b.companions as Booking['companions']) || undefined,
    venue_excess_hours: b.venue_excess_hours ? Number(b.venue_excess_hours) : undefined,
    created_at: b.created_at as string,
    expires_at: (b.expires_at as string) || null,
    partner_deal_id: (b.partner_deal_id as string) || undefined,
    company_name: (b.company_name as string) || undefined,
    vehicle_plate: (b.vehicle_plate as string) || undefined,
    invoice_number: (b.invoice_number as string) || undefined,
    invoice_type: (b.invoice_type as Booking['invoice_type']) || undefined,
    breakfast_included: !!b.breakfast_included,
    contract_rate_override: b.contract_rate_override ? Number(b.contract_rate_override) : undefined,
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
