import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Setup parser utility inside Deno
function parseiCal(icsText: string) {
  const events = []
  const lines = icsText.split(/\r?\n/)
  let currentEvent: any = {}
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

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch all configured room iCal feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('ical_feeds')
      .select('*')

    if (feedsError) throw feedsError

    let totalSynced = 0

    // 2. Loop and scrape feeds
    for (const feed of feeds) {
      const response = await fetch(feed.url)
      if (!response.ok) continue
      
      const icsString = await response.text()
      const parsedEvents = parseiCal(icsString)

      // 3. Delete past sync blocks for this room & channel to avoid stale blocks
      const sourceChannel = feed.channel === 'airbnb' ? 'airbnb' : 'booking_com'
      await supabase
        .from('bookings')
        .delete()
        .eq('room_id', feed.room_id)
        .eq('source', sourceChannel)

      // 4. Insert fresh blocks
      for (const evt of parsedEvents) {
        await supabase
          .from('bookings')
          .insert({
            room_id: feed.room_id,
            guest_name: evt.summary || 'External Synced Booking',
            guest_email: 'sync@external.ota',
            guest_phone: 'None',
            check_in: evt.start,
            check_out: evt.end,
            source: sourceChannel,
            status: 'confirmed'
          })
        totalSynced++
      }

      // Update feed timestamp
      await supabase
        .from('ical_feeds')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', feed.id)
    }

    // 5. Clean up expired website bookings
    await supabase
      .from('bookings')
      .delete()
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    return new Response(JSON.stringify({ success: true, syncedCount: totalSynced }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
