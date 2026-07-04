import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const roomId = url.searchParams.get('room_id')
    const roomNumberStr = url.searchParams.get('room_number')

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

    // Fetch confirmed & blocked bookings for this room
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('room_id', actualRoomId)
      .in('status', ['confirmed', 'blocked'])

    if (error) throw error

    // Formulate RFC 5545 iCal response
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//L\'Etoile Central Channel Manager//Boutique Suite//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ]

    bookings?.forEach(b => {
      const dateStart = b.check_in.replace(/-/g, '')
      const dateEnd = b.check_out.replace(/-/g, '')
      const createdStr = b.created_at.replace(/[-:.]/g, '').split('T')[0] + 'T000000Z'

      ics.push(
        'BEGIN:VEVENT',
        `UID:${b.id}@letoile-hotel.com`,
        `DTSTAMP:${createdStr}`,
        `DTSTART;VALUE=DATE:${dateStart}`,
        `DTEND;VALUE=DATE:${dateEnd}`,
        `SUMMARY:${b.source.toUpperCase()} - Reserved`,
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
