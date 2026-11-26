import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// **A booking request** (2026-11-12): a guest asking on Messenger or WhatsApp (our bot) or on the website. It is
// never a booking: the desk turns it into one on a bill, or turns it down (the owner: "the system
// shouldn't do anything on its own"). Only `request_booking` can add one.

export interface BookingRequest {
  id: string
  source: 'whatsapp' | 'messenger' | 'website'
  /** A room's or a venue's id. */
  room_id: string
  check_in: string
  check_out: string
  guests: number | null
  /** Everyone staying besides the guest; the bot asks for them when more than one is coming. */
  companions: string[]
  guest_name: string
  phone: string
  note: string | null
  /** What the guest was told the stay costs. */
  quoted_total: number | null
  language: string | null
  created_at: string
  /** What a website guest paid before sending (2026-11-17): the desk finds it in the app, then books it. */
  pay_amount?: number | null
  pay_method?: 'GCash' | 'Bank transfer' | null
  /** Which of the hotel's accounts it went to. */
  pay_account?: 'gcash' | 'bank' | 'bank2' | null
  pay_reference?: string | null
  /** The screenshot's path in the private `payment-shots` bucket. */
  pay_shot?: string | null
  /** What `read-payment-shot` read off it. */
  pay_read?: { reference?: string | null; amount?: number | null; sent_to_name?: string | null; sent_to_number?: string | null; when?: string | null; app?: string | null } | null
  /** The website's reserve flow (2026-11-26): the other rooms of the same request, */
  more_rooms?: string[]
  /** roughly when the guest arrives ("5 PM", "Evening"), */
  arrival?: string | null
  /** and, for a guest paying at the hotel, the day they said they would come to pay the half. */
  pay_on?: string | null
}

/** Every room (or the venue) a request asks for, the first one first. */
export const unitsOf = (r: BookingRequest) => [r.room_id, ...(r.more_rooms || [])]

/** A short-lived link to a payment screenshot; only the desk may look. */
export async function paymentShotUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('payment-shots').createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}

/** Who used this reference before ("Ana Cruz, 3 Nov"), or null. */
export async function referenceSeen(reference: string, except: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('payment_reference_seen', { p_reference: reference, p_except: except })
  if (error) throw error
  return (data as string | null) ?? null
}

export async function readBookingRequests(): Promise<BookingRequest[]> {
  const { data, error } = await supabase.from('booking_requests').select('*').eq('status', 'open').order('created_at')
  // A database without the table yet (live, until it is promoted) simply has nothing waiting.
  if (error) return []
  return (data || []) as BookingRequest[]
}

export async function closeBookingRequest(id: string, status: 'booked' | 'declined', bookingId?: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('close_booking_request', { p_id: id, p_status: status, p_booking_id: bookingId ?? null, p_note: note ?? null })
  if (error) throw error
}

export async function reopenBookingRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_booking_request', { p_id: id })
  if (error) throw error
}

/** The open requests, following the database live. `answered` takes one off the screen at once, and
 *  `refresh` reads again (a failed answer puts it back). */
export function useBookingRequests() {
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const refresh = useCallback(() => { void readBookingRequests().then(setRequests) }, [])
  const answered = useCallback((id: string) => setRequests(list => list.filter(r => r.id !== id)), [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('booking-requests-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  return { requests, answered, refresh }
}
