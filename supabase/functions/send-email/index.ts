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
 * Settings → Email asks it two more things: `{ check: true }` — is the Gmail connected,
 * and which address sends — and `{ test: true, to }`, a one-line test email, so whoever
 * connects it can see it work before a guest is waiting.
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

const reply = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const answer = (ok: boolean, message: string) => reply({ ok, message })

/** One line of plain words: no line breaks (they would start a new mail header), no tags. */
const oneLine = (value: unknown, max: number) =>
  Array.from(String(value ?? ''), ch => (ch < ' ' || ch === '\u007f' || ch === '<' || ch === '>') ? ' ' : ch)
    .join('').replace(/\s+/g, ' ').trim().slice(0, max)

const WHAT = {
  receipt: { name: 'payment receipt', subject: 'Payment receipt', file: 'Payment-Receipt' },
  statement: { name: 'billing statement', subject: 'Billing statement', file: 'Billing-Statement' },
} as const

const SIGN = [
  'Daweez Pension House',
  'National Highway, San Agustin Sur, Tandag City, Surigao del Sur',
  'Mobile No: 0910-7163830',
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let log: ((status: 'sent' | 'failed', error?: string) => Promise<void>) | null = null

  try {
    const body = await req.json().catch(() => null)
    if (!body) return answer(false, 'The email could not be sent.')

    const user = Deno.env.get('GMAIL_USER') ?? ''
    const pass = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
    const ready = !!(user && pass)

    if (body.check) return reply({ ok: true, ready, from: ready ? user : '' })

    const isTest = body.test === true
    const to = String(body.to ?? '').trim()
    if (to.length > 254 || !/^[^\s@,;:<>"()]+@[^\s@,;:<>"()]+\.[^\s@,;:<>"()]+$/.test(to)) {
      return answer(false, 'That email address does not look right.')
    }

    const kind = body.kind as keyof typeof WHAT
    const number = oneLine(body.number, 40)
    const guestName = oneLine(body.guestName, 80)
    const bookingId = oneLine(body.bookingId, 80)
    const pdf = String(body.pdf ?? '')

    if (!isTest) {
      if (!WHAT[kind] || !/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/.test(number) || !bookingId) {
        return answer(false, 'The email could not be sent.')
      }
      if (!/^[A-Za-z0-9+/]+=*$/.test(pdf) || pdf.length * 0.75 > MAX_PDF_BYTES || !atob(pdf.slice(0, 8)).startsWith('%PDF-')) {
        return answer(false, 'The paper could not be attached. Close it, open it again and try once more.')
      }
    }

    if (!ready) return answer(false, 'Email is not set up yet.')

    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    if (!isTest) {
      const { data: booking } = await db.from('bookings').select('id').eq('id', bookingId).maybeSingle()
      if (!booking) return answer(false, 'The email could not be sent.')
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await db.from('email_log')
      .select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', since)
    if (countError) return answer(false, 'The email could not be sent.')
    if ((count ?? 0) >= DAILY_LIMIT) {
      return answer(false, 'The limit of ' + DAILY_LIMIT + ' emails in a day is used up. Try again tomorrow.')
    }

    log = async (status, error) => {
      await db.from('email_log').insert({
        kind: isTest ? 'test' : kind, document_number: isTest ? 'test' : number, to_address: to,
        booking_id: isTest ? null : bookingId, status, error: error ?? null,
      })
    }

    const what = isTest ? null : WHAT[kind]
    const lines = what
      ? [
          guestName ? 'Good day, ' + guestName + '.' : 'Good day.',
          'Attached is your ' + what.name + ' ' + number + ' from Daweez Pension House.',
          'Thank you.',
        ]
      : ['This is a test from the Daweez Pension House booking system.', 'Receipts and billing statements can now be emailed from it.']

    // Port 465: Supabase blocks 25 and 587 from edge functions.
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
      connectionTimeout: 15000, socketTimeout: 30000,
    })
    await transport.sendMail({
      from: { name: 'Daweez Pension House', address: user },
      to,
      subject: (what ? what.subject + ' ' + number : 'Test email') + ' — Daweez Pension House',
      text: lines.join('\n\n') + '\n\n' + SIGN.join('\n'),
      html: lines.map(l => '<p>' + l + '</p>').join('') + '<p>' + SIGN.join('<br>') + '</p>',
      attachments: what ? [{
        filename: what.file + '-' + number.replace(/[^A-Za-z0-9-]+/g, '-') + '.pdf',
        content: pdf, encoding: 'base64', contentType: 'application/pdf',
      }] : [],
    })

    await log('sent')
    return answer(true, 'Sent to ' + to + '.')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('send-email failed:', reason)
    if (log) await log('failed', reason.slice(0, 500)).catch(() => {})
    // Google's own refusal of the address or the app password reads the same from here.
    const refused = /535|Invalid login|Username and Password not accepted/i.test(reason)
    return answer(false, refused
      ? 'Gmail did not accept the address or the app password. Check both in Settings, under Email.'
      : 'The email could not be sent. Check the address and try again.')
  }
})
