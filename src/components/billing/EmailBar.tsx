import React, { useId, useState } from 'react'
import { Loader2, Mail, X } from 'lucide-react'
import { EmailTarget, Paper, emailDocument, looksLikeEmail } from '../../utils/emailDocument'
import { showToast } from '../../utils/toast'

/** The Email button on a paper's control bar — the same shape as its Print button. */
export function EmailButton({ onClick, tone }: { onClick: () => void; tone: 'ink' | 'slate' }) {
  return (
    <button type="button" onClick={onClick}
      className={'bg-white hover:bg-slate-100 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ' +
        (tone === 'ink' ? 'text-ink-800' : 'text-slate-800')}>
      <Mail className="w-3.5 h-3.5" /> Email
    </button>
  )
}

/**
 * Where the paper is sent (the staff, 2026-10-04: they want to email payment receipts and
 * billing statements). It opens under the control bar with the booking's own address
 * already in the box, so most of the time the desk only presses Send; a booking with no
 * address leaves the box empty to be typed in.
 *
 * What went wrong is said under the box, where it was typed, and the box stays open so it
 * can be put right. Sent is a toast, and the bar closes.
 */
export function EmailBar({ target, paper, size, onClose, className = '' }: {
  target: EmailTarget
  /** The paper to attach, as it stands on the screen when Send is pressed. */
  paper: () => HTMLElement | null
  size: Paper
  onClose: () => void
  className?: string
}) {
  const [to, setTo] = useState(target.to)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState('')
  // Two papers can be open at once — a receipt over a bill — so the box's id is its own.
  const boxId = useId()

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    const sheet = paper()
    if (!looksLikeEmail(to)) { setProblem('Type the email address to send it to.'); return }
    if (!sheet) return
    setProblem('')
    setSending(true)
    try {
      await emailDocument(target, to, sheet, size)
      showToast('Sent to ' + to.trim() + '.')
      onClose()
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'The email could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={send} noValidate className={'bg-card text-main print:hidden ' + className}>
      <label htmlFor={boxId} className="block text-[13px] font-medium text-muted mb-1.5">Send to</label>
      <div className="flex items-center gap-2">
        <input id={boxId} type="email" inputMode="email" autoComplete="off" autoFocus
          value={to} onChange={e => { setTo(e.target.value); setProblem('') }} placeholder="guest@email.com" disabled={sending}
          aria-invalid={problem ? true : undefined} aria-describedby={problem ? boxId + '-problem' : undefined}
          className={'h-11 flex-1 min-w-0 rounded-md border bg-card px-3 text-[15px] font-medium text-main placeholder:font-normal placeholder:text-muted outline-none transition-colors duration-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-400/30 disabled:opacity-60 ' +
            (problem ? 'border-danger-400' : 'border-soft')} />
        <button type="submit" disabled={sending}
          className="h-11 px-4 shrink-0 inline-flex items-center gap-1.5 rounded-md bg-gold-400 hover:bg-gold-500 text-ink-900 text-[14px] font-semibold transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-default">
          {sending && <Loader2 className="w-4 h-4 animate-spin" />}
          {sending ? 'Sending' : 'Send'}
        </button>
        <button type="button" onClick={onClose} disabled={sending} aria-label="Cancel"
          className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:bg-softbg hover:text-main transition-colors duration-150 cursor-pointer disabled:opacity-60">
          <X className="w-4 h-4" />
        </button>
      </div>
      {problem && <p id={boxId + '-problem'} role="alert" className="mt-1.5 text-[13px] font-medium text-danger-600">{problem}</p>}
    </form>
  )
}
