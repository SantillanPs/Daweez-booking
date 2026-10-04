import { supabase } from './supabaseClient'

/**
 * Emailing a payment receipt or a billing statement (the staff, 2026-10-04: they want to
 * email both; until now they could only print).
 *
 * The email carries **the same paper as a PDF**: the document already on the screen is
 * drawn into a picture and laid on a page of the paper's own size — A5 for a statement,
 * the 58 mm roll for a receipt — so what the guest opens is what the printer would have
 * given them. The `send-email` function posts it from the hotel's own Gmail and writes
 * the words of the email itself.
 */

export type EmailKind = 'receipt' | 'statement'
export type Paper = 'a5' | 'slip'

/** What an Email button needs to know about the paper it sits on. */
export interface EmailTarget {
  kind: EmailKind
  /** The receipt or bill number — it names the email and the attached file. */
  number: string
  guestName: string
  bookingId: string
  /** The address the box opens with; empty when the booking holds none. */
  to: string
}

// A booking with no email typed is stored with one of these stand-ins.
const STAND_INS = ['admin@daweez-booking.vercel.app', 'sync@channel.external']

/** The guest's own address, or nothing — never a stand-in. */
export function guestEmailOf(booking: { guest_email?: string | null }): string {
  const email = (booking.guest_email || '').trim()
  return STAND_INS.includes(email) ? '' : email
}

export const looksLikeEmail = (value: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value.trim())

// The statement's printed sheet: A5 is 559px wide, with the paper's own margins
// (`print:px-8 print:py-4` in `StatementShell`).
const A5_WIDTH_PX = 559
const A5_MM = { width: 148, height: 210 }
const SLIP_WIDTH_MM = 58

/**
 * The paper on screen, as a one-page PDF in base64.
 *
 * The two libraries are fetched only when someone presses Send — they are large, and most
 * days nobody emails anything.
 */
export async function paperToPdf(paper: HTMLElement, size: Paper): Promise<string> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  if (document.fonts?.ready) await document.fonts.ready

  const canvas = await html2canvas(paper, {
    // The 58 mm slip is small type on a narrow strip; it needs more dots to stay sharp.
    scale: size === 'slip' ? 4 : 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    // Drawn as on a desk screen, whatever the phone or tablet it was sent from.
    windowWidth: 1280,
    onclone: (doc, copy) => {
      // A table row's fill is moved onto its cells. The picture is painted row by row, so
      // the second heading row's fill landed on top of the lower half of every cell that
      // spans both rows — `Room / Particulars` came out as `Room /` and `No. of Night` as
      // `No. of`. A browser paints all the row fills first; this makes the copy agree.
      copy.querySelectorAll('tr').forEach(row => {
        const fill = doc.defaultView?.getComputedStyle(row).backgroundColor
        if (!fill || fill === 'transparent' || fill === 'rgba(0, 0, 0, 0)') return
        row.style.backgroundColor = 'transparent'
        Array.from(row.children).forEach(cell => { (cell as HTMLElement).style.backgroundColor = fill })
      })
      if (size === 'a5') {
        // The sheet as the printer lays it out, not as the preview pads it.
        copy.style.width = A5_WIDTH_PX + 'px'
        copy.style.padding = '16px 32px'
        copy.style.overflow = 'visible'
        copy.style.maxHeight = 'none'
      } else {
        copy.style.margin = '0'
      }
    },
  })

  const width = size === 'a5' ? A5_MM.width : SLIP_WIDTH_MM
  const drawnHeight = canvas.height * width / canvas.width
  // A statement is at least a whole A5 sheet; a long one grows the page rather than being
  // cut across a line of the charges table.
  const height = size === 'a5' ? Math.max(A5_MM.height, drawnHeight) : drawnHeight

  const pdf = new jsPDF({ unit: 'mm', format: [width, height], orientation: 'portrait', compress: true })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, drawnHeight, undefined, 'FAST')
  return pdf.output('datauristring').split(',')[1]
}

/**
 * Send the paper. Resolves once it has left; rejects with a sentence the desk can read.
 */
export async function emailDocument(target: EmailTarget, to: string, paper: HTMLElement, size: Paper): Promise<void> {
  let pdf: string
  try {
    pdf = await paperToPdf(paper, size)
  } catch {
    throw new Error('The paper could not be turned into a PDF. Close it, open it again and try once more.')
  }

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to: to.trim(), kind: target.kind, number: target.number, guestName: target.guestName, bookingId: target.bookingId, pdf },
  })
  if (error) throw new Error('The email could not be sent. Check the internet connection and try again.')
  if (!data?.ok) throw new Error(data?.message || 'The email could not be sent.')
}
