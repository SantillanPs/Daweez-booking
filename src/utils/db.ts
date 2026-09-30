import { Room, Venue, Booking, SyncFeed, BookingSource, BookingStatus } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { randomUUID, isValidUUID } from './helpers'
import { DEFAULT_ROOMS, DEFAULT_VENUES } from './defaultData'

// The browser stores that used to sit here (`l_etoile_bookings_db`,
// `l_etoile_feeds_db`, plus `initDB`'s first-run seed) are gone: the database is
// the only home for a booking or a channel link. A save that cannot reach it now
// throws instead of parking the row in the browser — the fallback is how the
// hotel's room prices were typed, shown on every screen and never written
// (found 2026-09-28).

export async function getRooms(): Promise<Room[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('room_number')
      if (error) throw error
      if (data && data.length > 0) {
        const rooms = data.map(r => ({
          id: r.id,
          room_number: r.room_number,
          name: r.name,
          base_price: Number(r.base_price),
          promo_price: r.promo_price != null ? Number(r.promo_price) : null,
          breakfast_price: r.breakfast_price != null ? Number(r.breakfast_price) : null,
          hour3_price: r.hour3_price != null ? Number(r.hour3_price) : null,
          hour6_price: r.hour6_price != null ? Number(r.hour6_price) : null,
          hour12_price: r.hour12_price != null ? Number(r.hour12_price) : null,
          capacity: r.capacity,
          description: r.description || undefined,
          image_url: r.image_url || undefined
        })) as Room[]
        return rooms
      }
    } catch (err) {
      console.error('Supabase getRooms Error, falling back to defaults:', err)
    }
  }
  return DEFAULT_ROOMS
}

/**
 * Saves a room's one price (card k128). The app sends the same figure for the
 * Regular and Promo columns, so the rate card, the booking form and the printed
 * bill can never quote two different prices for one room.
 *
 * RLS grants anon only SELECT on `rooms`, so the write goes through the
 * SECURITY DEFINER `update_room_rate` RPC (the same pattern as the booking
 * writes). There is deliberately **no browser fallback here**: a rejected save
 * used to be swallowed and remembered in localStorage, which is exactly how
 * this failed — the desk typed the rates, every screen showed them, and the
 * database kept its original seed prices (found 2026-09-28). A failure now
 * throws, so the Settings save bar reports it and nothing pretends to be saved.
 */
export async function updateRoomRate(roomId: string, basePrice: number, promoPrice?: number | null): Promise<Room | null> {
  const base = Math.max(0, Math.round(basePrice))
  const promo = promoPrice != null && promoPrice > 0 ? Math.round(promoPrice) : null

  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this room price was not saved.')
  }

  // **ONE PRICE — both columns get the same figure** (the owner's ruling, 2026-09-29: *"the promo price
  // should be the new original price"*). The desk types one number, so both columns are written with it.
  // Writing only `promo_price` is what let `base_price` keep an older figure and the two drift apart on 9
  // of the 10 rooms. The pricing engine no longer reads `base_price` as a second price at all, but no
  // future reader should ever be able to find two different numbers here again.
  const price = promo != null && promo > 0 ? promo : base

  const { data, error } = await supabase.rpc('update_room_rate', {
    p_room_id: roomId,
    p_base_price: price,
    p_promo_price: price,
  })
  if (error) throw error
  return (data as unknown as Room) ?? null
}

/**
 * Saves what a room charges for breakfast (card k140) — one charge for the
 * stay, set by the desk. A room with no price sells no breakfast.
 *
 * Same shape as `updateRoomRate` next to it: RLS gives the app SELECT only on
 * `rooms`, so the write goes through a small SECURITY DEFINER function. No
 * browser copy — a failed save throws so the desk is told.
 */
export async function updateRoomBreakfastPrice(roomId: string, price: number): Promise<void> {
  const amount = Math.max(0, Math.round(price))

  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this breakfast price was not saved.')
  }

  const { error } = await supabase.rpc('set_room_breakfast_price', { p_room_id: roomId, p_price: amount })
  if (error) throw error
}

/**
 * Saves what a room charges for a short stay — 3, 6 and 12 hours (from the
 * hotel's printed rate board). Zero / blank means the room is NOT sold short,
 * which is the dash on that board; the 22-hour price stays the room's own price.
 *
 * Same shape as `updateRoomBreakfastPrice`: one small SECURITY DEFINER writer.
 * No browser copy — this is the save that silently went nowhere until
 * 2026-09-28 (the function cast the text id `room-3` to uuid and was rejected),
 * so it now throws and the desk sees it.
 */
export async function updateRoomHourPrices(
  roomId: string,
  hour3: number,
  hour6: number,
  hour12: number,
): Promise<void> {
  const h3 = Math.max(0, Math.round(hour3 || 0))
  const h6 = Math.max(0, Math.round(hour6 || 0))
  const h12 = Math.max(0, Math.round(hour12 || 0))

  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so these short-stay prices were not saved.')
  }

  const { error } = await supabase.rpc('set_room_hour_prices', {
    p_room_id: roomId, p_hour3: h3, p_hour6: h6, p_hour12: h12,
  })
  if (error) throw error
}

export async function getVenues(): Promise<Venue[]> {  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('venues').select('*').order('name')
      if (error) throw error
      if (data && data.length > 0) {
        return data.map(v => ({
          id: v.id,
          name: v.name,
          base_price: Number(v.base_price),
          promo_price: v.promo_price != null ? Number(v.promo_price) : null,
          capacity: v.capacity,
          description: v.description || undefined,
          image_url: v.image_url || undefined,
          details: v.details || undefined
        })) as Venue[]
      }
    } catch (err) {
      console.error('Supabase getVenues Error, falling back to defaults:', err)
    }
  }
  return DEFAULT_VENUES
}

export async function getBookings(): Promise<Booking[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
      if (error) throw error

      if (data) {
        const now = new Date()
        const activeRecords = data.filter(b => {
          if (b.status === 'pending' && b.expires_at) {
            const expires = new Date(b.expires_at)
            return expires > now
          }
          return true
        })

        // Remove abandoned 30-min locks via RPC (anon no longer has DELETE).
        try { await supabase.rpc('cleanup_expired_pending') } catch { /* non-fatal */ }

        return activeRecords.map(b => ({
          id: b.id,
          room_id: b.room_id || undefined,
          venue_id: b.venue_id || undefined,
          guest_name: b.guest_name,
          guest_email: b.guest_email,
          guest_phone: b.guest_phone,
          guest_gender: b.guest_gender || undefined,
          guest_nationality: b.guest_nationality || undefined,
          guest_address: b.guest_address || undefined,
          birthdate: b.birthdate || undefined,
          check_in: b.check_in,
          check_out: b.check_out,
          source: b.source as BookingSource,
          status: b.status as BookingStatus,
          payment_status: (b as { payment_status?: Booking['payment_status'] }).payment_status || undefined,
          payment_method: b.payment_method || undefined,
          payment_reference: b.payment_reference || undefined,
          payment_plan: (b as { payment_plan?: Booking['payment_plan'] }).payment_plan || undefined,
          downpayment_paid: Number(b.downpayment_paid || 0),
          balance_due: Number(b.balance_due || 0),
          security_deposit: Number(b.security_deposit || 0),            promo_applied: (b as { promo_applied?: boolean }).promo_applied ?? undefined,          breakfast_orders: b.breakfast_orders || undefined,
          equipment_rentals: b.equipment_rentals || undefined,
          event_addons: b.event_addons || undefined,
          companions: b.companions || undefined,
          venue_excess_hours: b.venue_excess_hours ? Number(b.venue_excess_hours) : undefined,
          created_at: b.created_at,
          expires_at: b.expires_at || null,
          partner_deal_id: b.partner_deal_id || undefined,
          company_name: b.company_name || undefined,
          vehicle_plate: b.vehicle_plate || undefined,
          invoice_number: b.invoice_number || undefined,
          invoice_type: b.invoice_type || undefined,
          breakfast_included: !!b.breakfast_included,
          contract_rate_override: b.contract_rate_override ? Number(b.contract_rate_override) : undefined,
          applied_discount: (b as { applied_discount?: Booking['applied_discount'] }).applied_discount || undefined,
          early_check_in_hours: b.early_check_in_hours != null ? Number(b.early_check_in_hours) : undefined,
          late_check_out_hours: b.late_check_out_hours != null ? Number(b.late_check_out_hours) : undefined,
          actual_check_in: b.actual_check_in || undefined,
          actual_check_out: b.actual_check_out || undefined,
          notes: b.notes || undefined,
          prepared_by: b.prepared_by || undefined,
          reference_number: b.reference_number || undefined,
          registered_on: b.registered_on || undefined,
          payment_records: (b as { payment_records?: Booking['payment_records'] }).payment_records || undefined,
          venue_day_blocks: b.venue_day_blocks != null ? Number(b.venue_day_blocks) : undefined,
          breakfast_days: (b as { breakfast_days?: string[] }).breakfast_days || undefined,
          breakfast_records: (b as { breakfast_records?: Booking['breakfast_records'] }).breakfast_records || undefined,
          // SHORT STAY: this mapping used to stop at `breakfast_records`, so every short
          // stay arrived in the app WITHOUT its hours — the quick view read it as an
          // ordinary overnight booking (`Sep 24 → Sep 25 · 1 night`), priced it as a whole
          // night, and the ₱800 already taken on a ₱650 twelve-hour stay made it look
          // **partly paid**. The database still held `stay_hours` (that writer refuses a
          // blank), which is why the row and the screen disagreed. The realtime mapper
          // always carried this field; this read path must carry it too.
          stay_hours: b.stay_hours != null ? Number(b.stay_hours) : undefined
        }))
      }
    } catch (err) {
      console.error('Supabase getBookings Error:', err)
    }
  }

  // No browser copy any more. If the database could not be read, the screen
  // shows no bookings rather than a stale store that was never the truth.
  return []
}

// ── Shared Supabase record mapper (single source of truth for column shape) ──
function toBookingRecord(booking: Booking): Record<string, unknown> {
  return {
    id: booking.id,
    room_id: booking.room_id || null,
    venue_id: booking.venue_id || null,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone,
    guest_gender: booking.guest_gender || null,
    guest_nationality: booking.guest_nationality || null,
    guest_address: booking.guest_address || null,
    birthdate: booking.birthdate || null,
    check_in: booking.check_in,
    check_out: booking.check_out,
    source: booking.source,
    status: booking.status,
    payment_status: booking.payment_status || null,
    payment_method: booking.payment_method || null,
    payment_reference: booking.payment_reference || null,
    payment_plan: booking.payment_plan || null,
    downpayment_paid: booking.downpayment_paid,
    balance_due: booking.balance_due,
    security_deposit: booking.security_deposit,
    breakfast_orders: booking.breakfast_orders || null,
    equipment_rentals: booking.equipment_rentals || null,
    event_addons: booking.event_addons || null,
    companions: booking.companions || null,
    venue_excess_hours: booking.venue_excess_hours || 0,
    expires_at: booking.expires_at || null,
    partner_deal_id: booking.partner_deal_id || null,
    company_name: booking.company_name || null,
    vehicle_plate: booking.vehicle_plate || null,
    invoice_number: booking.invoice_number || null,
    invoice_type: booking.invoice_type || null,
    breakfast_included: !!booking.breakfast_included,
    contract_rate_override: booking.contract_rate_override || null,
    promo_applied: booking.promo_applied ?? null,
    applied_discount: booking.applied_discount || null,
    early_check_in_hours: booking.early_check_in_hours ?? null,
    late_check_out_hours: booking.late_check_out_hours ?? null,
    actual_check_in: booking.actual_check_in || null,
    actual_check_out: booking.actual_check_out || null,
    notes: booking.notes || null,
    prepared_by: booking.prepared_by || null,
    reference_number: booking.reference_number || null,
    registered_on: booking.registered_on || null,
    payment_records: booking.payment_records || null,
    venue_day_blocks: booking.venue_day_blocks ?? null,
    breakfast_days: booking.breakfast_days || null,
    breakfast_records: booking.breakfast_records || null,
    // Short stay (hours the room was taken for). Written by its own small writer
    // after the booking lands, like the agreed deposit above.
    stay_hours: booking.stay_hours ?? null,
  }
}

/**
 * Saves the deposit the desk agreed with the guest (card k130) through its own
 * small SECURITY DEFINER writer.
 *
 * Why not the booking RPCs: `book_booking` / `update_booking` are the drifted
 * jsonb functions (see the note in supabase/AGENTS.md) — they copy a fixed list
 * of keys out of the payload by hand, so a new column means rebuilding them from
 * the live definition. One narrow writer keeps this change contained, and a
 * failure is never fatal: the rest of the booking is already saved and the column
 * simply keeps its default, "work the deposit out from the stay".
 */
async function writeAgreedDeposit(bookingId: string, amount?: number): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_booking_agreed_deposit', {
      p_booking_id: bookingId,
      p_amount: amount ?? 0,
    })
    if (error) throw error
  } catch (err) {
    console.error('Could not save the agreed deposit:', err)
  }
}

/**
 * Marks a booking as a SHORT STAY — the hours the room was taken for (3/6/12/22).
 *
 * Its own small writer for the same reason as the agreed deposit above: the
 * booking RPCs are the drifted jsonb functions, so a new column is threaded
 * through a narrow SECURITY DEFINER writer instead of rebuilding them. A lost
 * write only means the booking reads as an ordinary overnight stay.
 */
async function writeStayHours(bookingId: string, hours?: number): Promise<void> {
  if (!hours) return
  try {
    const { error } = await supabase.rpc('set_booking_stay_hours', {
      p_booking_id: bookingId,
      p_hours: hours,
    })
    if (error) throw error
  } catch (err) {
    console.error('Could not save the short-stay hours:', err)
  }
}

// Business-rule failures (ROOM_UNAVAILABLE / VENUE_UNAVAILABLE / date order) and
// every other write failure now surface to the caller alike: nothing is parked in
// the browser, so a booking that could not be saved must say so.

// Compute the next sequential invoice number for a check-in month.
async function nextInvoiceNumber(checkInDate: string): Promise<string> {
  const allBookings = await getBookings()
  const prefixYearMonth = checkInDate.substring(0, 7)
  const prefixDocType = 'GRF'

  const sameMonthBookings = allBookings.filter(b =>
    b.invoice_number &&
    b.invoice_number.startsWith(`${prefixDocType}-${prefixYearMonth}-`)
  )

  let nextSeq = 1
  if (sameMonthBookings.length > 0) {
    const seqs = sameMonthBookings.map(b => {
      const parts = b.invoice_number!.split('-')
      const lastPart = parts[parts.length - 1]
      const num = parseInt(lastPart, 10)
      return isNaN(num) ? 0 : num
    })
    nextSeq = Math.max(...seqs) + 1
  }

  return `${prefixDocType}-${prefixYearMonth}-${String(nextSeq).padStart(4, '0')}`
}

export async function saveBookings(bookings: Booking[]): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so these bookings were not saved.')
  }

  // Per-row insert/update through the RPCs (whole-array upsert is no longer
  // permitted for anon and would cause lost updates between tabs).
  const existing = await getBookings()
  for (const b of bookings) {
    if (existing.some(x => x.id === b.id)) {
      await updateBooking(b)
    } else {
      await insertBooking(b)
    }
  }
}

export async function insertBooking(booking: Booking): Promise<Booking> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this booking was not saved.')
  }

  // The DB id column is UUID-typed; legacy ids ('manual-abc') would silently
  // fail on Supabase, so normalize to a real UUID before writing.
  const dbId = isValidUUID(booking.id) ? booking.id! : randomUUID()
  const withId: Booking = { ...booking, id: dbId }

  // Assign a sequential invoice number client-side (retried on conflict below).
  if (!withId.invoice_number && withId.status !== 'blocked') {
    withId.invoice_number = await nextInvoiceNumber(withId.check_in)
  }

  const record = toBookingRecord(withId)

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.rpc('book_booking', { p_booking: record })
    if (error) {
      // Race on the sequential invoice number → bump and retry.
      const isInvoiceConflict = withId.invoice_number &&
        (error.code === '23505' || /duplicate key/i.test(String(error.message || '')))
      if (isInvoiceConflict) {
        withId.invoice_number = await nextInvoiceNumber(withId.check_in)
        record.invoice_number = withId.invoice_number
        continue
      }
      throw error
    }
    await writeAgreedDeposit(withId.id, withId.agreed_deposit)
    await writeStayHours(withId.id, withId.stay_hours)
    const saved = (data as unknown as Booking) ?? withId
    // The booking RPC does not carry the agreed deposit or the short-stay hours
    // (see the writers above), so put them back on the row the caller caches.
    return { ...saved, agreed_deposit: withId.agreed_deposit, stay_hours: withId.stay_hours }
  }

  throw new Error('The booking could not be saved — its invoice number kept clashing. Please try again.')
}

export async function updateBooking(booking: Booking): Promise<Booking> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this booking was not saved.')
  }

  // bookings.id is a TEXT column that may hold non-UUID ids (manual-…, imported-…).
  // The update_booking RPC takes text ids, so call it for every id in online mode.
  const { data, error } = await supabase.rpc('update_booking', { p_booking: toBookingRecord(booking) })
  if (error) throw error
  await writeAgreedDeposit(booking.id, booking.agreed_deposit)
  await writeStayHours(booking.id, booking.stay_hours)
  const saved = (data as unknown as Booking) ?? booking
  return { ...saved, agreed_deposit: booking.agreed_deposit, stay_hours: booking.stay_hours }
}

export async function deleteBooking(bookingId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this booking was not deleted.')
  }

  // bookings.id is TEXT and may be a non-UUID id (manual-…, imported-…); delete_booking takes text.
  const { error } = await supabase.rpc('delete_booking', { p_booking_id: bookingId })
  if (error) throw error
}

export async function confirmBooking(bookingId: string): Promise<Booking> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this booking was not confirmed.')
  }

  // bookings.id is TEXT and may be a non-UUID id (manual-…, imported-…); confirm_booking takes text.
  const { data, error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId })
  if (error) throw error
  return data as unknown as Booking
}

export async function getFeeds(): Promise<SyncFeed[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('ical_feeds').select('*')
      if (error) throw error
      if (data) {
        return data.map(f => ({
          id: f.id,
          room_id: f.room_id,
          channel: f.channel,
          url: f.url,
          last_synced: f.last_synced
        }))
      }
    } catch (err) {
      console.error('Supabase getFeeds Error:', err)
    }
  }

  return []
}

export async function saveFeeds(feeds: SyncFeed[]): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so these channel links were not saved.')
  }

  const records = feeds.map(f => ({
    id: f.id,
    room_id: f.room_id,
    channel: f.channel,
    url: f.url,
    last_synced: f.last_synced
  }))
  const { error } = await supabase.from('ical_feeds').upsert(records)
  if (error) throw error
}
