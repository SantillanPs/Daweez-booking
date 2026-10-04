import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer@6.9.16"

/**
 * Emails a payment receipt or a guest billing statement, as a PDF, from the hotel's own
 * Gmail (the staff, 2026-10-04: they want to email both; until now they could only print).
 *
 * The browser draws the PDF from the paper on the screen and hands it over; this function
 * only posts it. It needs two secrets on the project — `GMAIL_USER` (the hotel's address)
 * and `GMAIL_APP_PASSWORD` (an app password made on that Google account) — and says
 * plainly that email is not set up while either is missing.
 *
 * **What it refuses, and why.** The app has no staff logins yet (card k74), so this can be
 * called by anyone holding the site's public key. To keep the hotel's address from being
 * used to send anything but its own paper:
 *   - the words of the email are written HERE, never taken from the caller;
 *   - there is one recipient, one attachment, and the attachment must be a PDF under 3 MB;
 *   - the booking it is for must exist;
 *   - no more than `DAILY_LIMIT` leave in any 24 hours (counted in `email_log`).
 *
 * Every answer is HTTP 200 with `{ ok, message }`: the message is the sentence the desk
 * reads, so the screen never has to translate an error code.
 */

const DAILY_LIMIT = 100
const MAX_PDF_BYTES = 3 * 1024 * 1024

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const answer = (ok: boolean, message: string) =>
  new Response(JSON.stringify({ ok, message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** One line of plain words: no line breaks (they would start a new mail header), no tags. */
const oneLine = (value: unknown, max: number) =>
  Array.from(String(value ?? ''), ch => (ch < ' ' || ch === '\u007f' || ch === '<' || ch === '>') ? ' ' : ch)
    .join('').replace(/\s+/g, ' ').trim().slice(0, max)

const WHAT = {
  receipt: { name: 'payment receipt', subject: 'Payment receipt', file: 'Payment-Receipt' },
  statement: { name: 'billing statement', subject: 'Billing statement', file: 'Billing-Statement' },
} as const

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let log: ((status: 'sent' | 'failed', error?: string) => Promise<void>) | null = null

  try {
    const body = await req.json().catch(() => null)
    if (!body) return answer(false, 'The email could not be sent.')

    const to = String(body.to ?? '').trim()
    const kind = body.kind as keyof typeof WHAT
    const number = oneLine(body.number, 40)
    const guestName = oneLine(body.guestName, 80)
    const bookingId = oneLine(body.bookingId, 80)
    const pdf = String(body.pdf ?? '')

    if (to.length > 254 || !/^[^\s@,;:<>"()]+@[^\s@,;:<>"()]+\.[^\s@,;:<>"()]+$/.test(to)) {
      return answer(false, 'That email address does not look right.')
    }
    if (!WHAT[kind] || !/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/.test(number) || !bookingId) {
      return answer(false, 'The email could not be sent.')
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(pdf) || pdf.length * 0.75 > MAX_PDF_BYTES || !atob(pdf.slice(0, 8)).startsWith('%PDF-')) {
      return answer(false, 'The paper could not be attached. Close it, open it again and try once more.')
    }

    const user = Deno.env.get('GMAIL_USER') ?? ''
    const pass = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
    if (!user || !pass) return answer(false, 'Email is not set up yet.')

    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const { data: booking } = await db.from('bookings').select('id').eq('id', bookingId).maybeSingle()
    if (!booking) return answer(false, 'The email could not be sent.')

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await db.from('email_log')
      .select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', since)
    if (countError) return answer(false, 'The email could not be sent.')
    if ((count ?? 0) >= DAILY_LIMIT) {
      return answer(false, 'The limit of ' + DAILY_LIMIT + ' emails in a day is used up. Try again tomorrow.')
    }

    log = async (status, error) => {
      await db.from('email_log').insert({
        kind, document_number: number, to_address: to, booking_id: bookingId, status, error: error ?? null,
      })
    }

    const what = WHAT[kind]
    const greeting = guestName ? 'Good day, ' + guestName + '.' : 'Good day.'
    const lines = [
      greeting,
      'Attached is your ' + what.name + ' ' + number + ' from Daweez Pension House.',
      'Thank you.',
    ]
    const sign = [
      'Daweez Pension House',
      'National Highway, San Agustin Sur, Tandag City, Surigao del Sur',
      'Mobile No: 0910-7163830',
    ]

    // Port 465: Supabase blocks 25 and 587 from edge functions.
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
      connectionTimeout: 15000, socketTimeout: 30000,
    })
    await transport.sendMail({
      from: { name: 'Daweez Pension House', address: user },
      to,
      subject: what.subject + ' ' + number + ' — Daweez Pension House',
      text: lines.join('\n\n') + '\n\n' + sign.join('\n'),
      html: lines.map(l => '<p>' + l + '</p>').join('') + '<p>' + sign.join('<br>') + '</p>',
      attachments: [{
        filename: what.file + '-' + number.replace(/[^A-Za-z0-9-]+/g, '-') + '.pdf',
        content: pdf, encoding: 'base64', contentType: 'application/pdf',
      }],
    })

    await log('sent')
    return answer(true, 'Sent to ' + to + '.')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('send-email failed:', reason)
    if (log) await log('failed', reason.slice(0, 500)).catch(() => {})
    return answer(false, 'The email could not be sent. Check the address and try again.')
  }
})
