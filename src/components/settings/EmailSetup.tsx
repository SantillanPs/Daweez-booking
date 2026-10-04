import React, { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { emailSetup, looksLikeEmail, sendTestEmail } from '../../utils/emailDocument'
import { Field } from '../walk-in/Field'
import { FIELD_IN_ROW, GROUP_TITLE, REVEAL, TEXT_ACTION } from '../walk-in/formStyles'
import { Section } from './parts'

// The Supabase project this copy of the app talks to, so step 3 opens the right one.
const PROJECT = (import.meta.env.VITE_SUPABASE_URL || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || '_'

const SECRETS = [
  { name: 'GMAIL_USER', holds: 'the hotel’s Gmail address' },
  { name: 'GMAIL_APP_PASSWORD', holds: 'the 16 letters, no spaces' },
]

/** A link out to Google or Supabase, opened beside the app so the steps stay in view. */
function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-[14px] font-semibold text-brand-text hover:underline">
      {children} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
    </a>
  )
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 py-3.5">
      <span className="font-display text-[15px] font-bold text-brand-text tabular-nums">{n}</span>
      <div className="space-y-1.5">
        <p className="text-[15px] font-medium text-main">{title}</p>
        {children}
      </div>
    </li>
  )
}

/**
 * Settings → Email: whether the hotel's Gmail is connected, how to connect it, and a test
 * (asked for on 2026-10-04, so that staff can know how to set it up).
 *
 * The app password is never typed into this app. It is saved in Supabase's own secrets,
 * where only the sending function can read it — which is why step 3 leaves the app and
 * needs the Supabase login. Once it is connected the steps fold away, and the page is the
 * address that sends and the test.
 */
export function EmailSetup() {
  // `null` while the function is being asked.
  const [setup, setSetup] = useState<{ ready: boolean; from: string } | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [copied, setCopied] = useState('')

  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const check = () => {
    setSetup(null)
    void emailSetup().then(setSetup)
  }
  useEffect(() => {
    let left = false
    void emailSetup().then(s => { if (!left) setSetup(s) })
    return () => { left = true }
  }, [])

  const copy = (name: string) => {
    void navigator.clipboard.writeText(name).then(() => {
      setCopied(name)
      setTimeout(() => setCopied(c => (c === name ? '' : c)), 1500)
    })
  }

  const test = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    if (!looksLikeEmail(to)) { setResult({ ok: false, text: 'Type the email address to send the test to.' }); return }
    setResult(null)
    setSending(true)
    try {
      await sendTestEmail(to)
      setResult({ ok: true, text: 'Sent to ' + to.trim() + '. Look for it in that inbox.' })
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'The test could not be sent.' })
    } finally {
      setSending(false)
    }
  }

  const stepsOpen = setup !== null && (!setup.ready || showSteps)

  return (
    <div className="max-w-[640px] space-y-9">
      <section>
        <h3 className={GROUP_TITLE}>Email</h3>
        <p className="mt-1 text-[13px] text-muted">Receipts and billing statements are emailed from the hotel’s Gmail.</p>
        <div className="mt-3 min-h-11 flex flex-wrap items-center justify-between gap-x-4 border-y border-soft">
          {setup === null ? (
            <span className="h-3.5 w-52 rounded-sm bg-softbg animate-pulse" aria-label="Checking" />
          ) : setup.ready ? (
            <p className="text-[15px]">
              <span className="font-semibold text-brand-text">Connected</span>
              <span className="text-muted"> · sends from </span>
              <span className="font-medium text-main break-all">{setup.from}</span>
            </p>
          ) : (
            <p className="text-[15px] font-semibold text-main">Not set up yet</p>
          )}
          {setup !== null && (
            <button type="button" onClick={check} className={TEXT_ACTION}>Check again</button>
          )}
        </div>
        {setup?.ready && (
          <button type="button" onClick={() => setShowSteps(open => !open)} aria-expanded={showSteps} className={TEXT_ACTION}>
            {showSteps ? 'Hide the steps' : 'Show how it is connected'}
          </button>
        )}
      </section>

      {stepsOpen && (
        <div className={REVEAL}>
          <Section title="Connect the hotel’s Gmail">
            <ol className="border-y border-soft divide-y divide-soft">
              <Step n={1} title="Sign in to the hotel’s Google account and turn on 2-Step Verification.">
                <Out href="https://myaccount.google.com/security">Open Google security</Out>
              </Step>
              <Step n={2} title="Make an app password named “Daweez PMS” and copy its 16 letters.">
                <Out href="https://myaccount.google.com/apppasswords">Open app passwords</Out>
              </Step>
              <Step n={3} title="In Supabase, under Edge Functions → Secrets, add these two. This step needs the Supabase login.">
                <ul className="space-y-1">
                  {SECRETS.map(s => (
                    <li key={s.name} className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                      <code className="font-mono text-[13px] font-semibold text-main select-all">{s.name}</code>
                      <span className="text-muted">{s.holds}</span>
                      <button type="button" onClick={() => copy(s.name)}
                        className="text-[13px] font-semibold text-brand-text hover:underline cursor-pointer">
                        {copied === s.name ? 'Copied' : 'Copy name'}
                      </button>
                    </li>
                  ))}
                </ul>
                <Out href={'https://supabase.com/dashboard/project/' + PROJECT + '/functions/secrets'}>Open Supabase secrets</Out>
              </Step>
              <Step n={4} title="Send a test, below." />
            </ol>
          </Section>
        </div>
      )}

      <Section title="Send a test">
        <form onSubmit={test} noValidate>
          <Field label="Send to" error={result && !result.ok ? result.text : ''}>
            <span className="flex items-center gap-2">
              <input type="email" inputMode="email" autoComplete="off" value={to} disabled={sending}
                onChange={e => { setTo(e.target.value); setResult(null) }} placeholder="your@email.com" className={FIELD_IN_ROW} />
              <button type="submit" disabled={sending}
                className="h-11 px-4 shrink-0 inline-flex items-center gap-1.5 rounded-md bg-gold-400 hover:bg-gold-500 text-ink-900 text-[14px] font-semibold transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-default">
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                {sending ? 'Sending' : 'Send test'}
              </button>
            </span>
          </Field>
          {result?.ok && <p role="status" className="mt-1.5 text-[13px] font-medium text-brand-text">{result.text}</p>}
        </form>
      </Section>
    </div>
  )
}
