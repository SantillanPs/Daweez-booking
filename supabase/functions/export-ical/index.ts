import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const roomId = url.searchParams.get('room_id')

    if (!roomId) {
      return new Response("Missing room_id query parameter", { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch confirmed & blocked bookings for this room
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['confirmed', 'blocked'])

    if (error) throw error

    // Formulate RFC 5545 iCal response
    let ics = [
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
        "Content-Disposition": `attachment; filename="room-${roomId}.ics"`
      }
    })
  } catch (err: any) {
    return new Response(err.message, { status: 500 })
  }
})
