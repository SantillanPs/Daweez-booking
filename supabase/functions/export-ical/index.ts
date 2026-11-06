import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CHANNELS = ['airbnb', 'booking_com']

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const roomId = url.searchParams.get('room_id')
    const roomNumberStr = url.searchParams.get('room_number')
    // Who is asking, so a stay is not sent back to the site it came from (`channel_export`).
    const forChannel = url.searchParams.get('for')

    if (!roomId && !roomNumberStr) {
      return new Response("Missing room_id or room_number query parameter", { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    let actualRoomId = roomId

    if (!actualRoomId && roomNumberStr) {
      const roomNum = parseInt(roomNumberStr, 10)
      if (isNaN(roomNum)) {
        return new Response("Invalid room_number parameter", { status: 400 })
      }

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_number', roomNum)
        .maybeSingle()

      if (roomError) throw roomError
      if (!room) {
        return new Response(`Room number ${roomNum} not found`, { status: 404 })
      }

      actualRoomId = room.id
    }

    // The nights this room cannot be sold, reservations waiting for money included: 14 of the 19
    // pending stays on live were still to come when this link only listed confirmed ones.
    const { data: rows, error } = await supabase.rpc('channel_export', {
      p_room_id: actualRoomId,
      p_for: forChannel && CHANNELS.includes(forChannel) ? forChannel : null,
    })

    if (error) throw error

    // Formulate RFC 5545 iCal response. It says the dates are taken and nothing about who.
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Daweez Pension House//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ]

    const dayAfter = (iso: string) => {
      const d = new Date(iso + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      return d.toISOString().slice(0, 10)
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    rows?.forEach((b: { id: string; first_night: string; last_night: string }) => {
      ics.push(
        'BEGIN:VEVENT',
        `UID:${b.id}@daweez-booking.vercel.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${b.first_night.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${dayAfter(b.last_night).replace(/-/g, '')}`,
        'SUMMARY:Not available',
        'STATUS:CONFIRMED',
        'END:VEVENT'
      )
    })

    ics.push('END:VCALENDAR')
    const fileContent = ics.join('\r\n')

    return new Response(fileContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="room-${roomNumberStr || roomId}.ics"`
      }
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(errMsg, { status: 500 })
  }
})
