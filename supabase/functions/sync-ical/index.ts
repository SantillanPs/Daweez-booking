import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Setup parser utility inside Deno
function parseiCal(icsText: string) {
  const events = []
  const lines = icsText.split(/\r?\n/)
  let currentEvent: Record<string, string> = {}
  let inEvent = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].substring(1)
      i++
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
    } else if (line === 'END:VEVENT') {
      inEvent = false
      if (currentEvent.start && currentEvent.end) {
        events.push(currentEvent)
      }
    } else if (inEvent) {
      const parts = line.split(':')
      const key = parts[0]
      const value = parts.slice(1).join(':')

      if (key.startsWith('DTSTART')) {
        currentEvent.start = parseDate(value)
      } else if (key.startsWith('DTEND')) {
        currentEvent.end = parseDate(value)
      } else if (key === 'SUMMARY') {
        currentEvent.summary = value
      }
    }
  }
  return events
}

function parseDate(val: string): string {
  const dateStr = val.split('T')[0] // YYYYMMDD
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 0. THE SWITCHES (the owner's ruling, 2026-09-30: *"can we have a toggle to turn enable and disable
    //    ical connections?"*). `channel_sync` in `app_settings` holds the master on/off and the rooms taken
    //    off, and it is read HERE, on the server, because this function is what actually fetches: a
    //    client-side check alone could be skipped by an old tab left open on another machine, which is
    //    exactly how nine feeds ended up downloading the same Airbnb calendar nine times.
    //    A missing row, or anything that is not an explicit `false`, means ON — a half-written setting must
    //    never leave the hotel silently un-synced.
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'channel_sync')
      .maybeSingle()

    const masterOn = setting?.value?.enabled !== false
    const offRooms = (setting?.value?.rooms ?? {}) as Record<string, boolean>
    let skippedRooms = 0

    // 1. Fetch all configured room iCal feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('ical_feeds')
      .select('*')

    if (feedsError) throw feedsError

    let totalSynced = 0
    let totalSkipped = 0

    // 2. Loop and scrape feeds (non-destructive, idempotent, collision-aware)
    for (const feed of masterOn ? (feeds || []) : []) {
      if (!feed.url) continue // Skip feeds that have no URL configured

      // A room the desk switched off is left completely alone: not fetched, and not compared with
      // its link either. Off means off, and the desk's existing rows stay exactly as they are until they
      // switch it back on.
      if (offRooms[feed.room_id] === false) {
        skippedRooms++
        continue
      }

      try {
        const response = await fetch(feed.url)
        if (!response.ok) continue

        const icsString = await response.text()
        // A login page or an error page is not an empty calendar: read as one, every stay on
        // the room would be reported as gone.
        if (!icsString.includes('BEGIN:VCALENDAR')) continue

        const channel = feed.channel === 'airbnb' ? 'airbnb' : 'booking_com'
        const prefix = `${channel}|${feed.room_id}|`
        const refOf = (evt: Record<string, string>) => `${prefix}${evt.start}|${evt.end}`
        // A stay already over needs nothing from anyone, and a link may drop it at any time.
        const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
        const events = parseiCal(icsString).filter(evt => evt.start < evt.end && evt.end > today)
        const onLink = new Set(events.map(refOf))

        // 3. What this link has already put on the calendar, wherever the desk has moved it since,
        //    and what it has already asked the desk.
        const { data: linked, error: linkedError } = await supabase
          .from('bookings')
          .select('id, channel_ref, status, check_in')
          .like('channel_ref', `${prefix}%`)
        if (linkedError) throw linkedError
        const { data: asked, error: askedError } = await supabase
          .from('channel_alerts')
          .select('id, ref, kind, status')
          .like('ref', `${prefix}%`)
        if (askedError) throw askedError

        // 4. The sync ADDS a stay and asks about the rest; it never changes or removes a booking
        //    (Sebastian, 2026-10-20: the app must not change a booking by itself). This used to
        //    delete whatever had left the link, money and all, and to drop a clash with one line in a log.
        for (const evt of events) {
          const ref = refOf(evt)
          const rows = (linked || []).filter(b => b.channel_ref === ref)
          if (rows.some(b => b.status !== 'cancelled')) {
            // It is back on the link: the question of it being gone has gone too.
            await supabase.from('channel_alerts').delete().eq('ref', ref).eq('kind', 'gone')
            continue
          }
          // Cancelled here and still on the link: the desk has decided, so it does not come back.
          if (rows.length > 0) continue
          // The desk has answered "Sold twice" for this stay.
          if ((asked || []).some(a => a.ref === ref && a.kind === 'clash' && a.status === 'done')) continue

          const { data: result, error: addError } = await supabase.rpc('add_channel_stay', {
            p_channel: channel, p_ref: ref, p_room_id: feed.room_id, p_check_in: evt.start, p_check_out: evt.end,
          })
          if (addError) {
            totalSkipped++
            console.warn(`Could not add ${ref}: ${addError.message}`)
          } else if (result?.added) totalSynced++
          else if (result?.clash_with) totalSkipped++
        }

        // A stay that left the link. Only one still to come is asked about.
        for (const b of linked || []) {
          if (onLink.has(b.channel_ref)) continue
          if (b.status === 'cancelled') {
            // Dealt with. Forgetting the link lets the same dates be sold again later.
            await supabase.from('bookings').update({ channel_ref: null }).eq('id', b.id)
            await supabase.from('channel_alerts').delete().eq('ref', b.channel_ref).eq('kind', 'gone')
          } else if (b.check_in >= today) {
            const [, , start, end] = b.channel_ref.split('|')
            await supabase.from('channel_alerts').upsert(
              { kind: 'gone', channel, ref: b.channel_ref, room_id: feed.room_id, check_in: start, check_out: end, booking_id: b.id },
              { onConflict: 'ref,kind', ignoreDuplicates: true },
            )
          }
        }
        // A sale that left the link is no longer sold twice.
        for (const a of asked || []) {
          if (a.kind === 'clash' && !onLink.has(a.ref)) await supabase.from('channel_alerts').delete().eq('id', a.id)
        }

        // Update feed timestamp
        await supabase
          .from('ical_feeds')
          .update({ last_synced: new Date().toISOString() })
          .eq('id', feed.id)
      } catch (feedErr) {
        console.error(`Failed to sync feed ${feed.id} for room ${feed.room_id}:`, feedErr)
        continue
      }
    }

    // 5. Clean up expired website bookings — deliberately NOT behind the master switch: expiring an unpaid
    //    website hold is the app's own job, and it has nothing to do with the channels. Switching iCal off
    //    must not leave abandoned holds blocking rooms forever.
    await supabase
      .from('bookings')
      .delete()
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    return new Response(JSON.stringify({
      success: true,
      syncedCount: totalSynced,
      skippedCount: totalSkipped,
      channelsOn: masterOn,
      skippedRooms
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
