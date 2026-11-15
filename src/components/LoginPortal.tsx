import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'

/** The device remembers the last email that signed in, so on a tablet the staff only type the password. */
const EMAIL_KEY = 'daweez_login_email'

interface LoginPortalProps {
  onLoginSuccess: () => void
}

const BOX = 'w-full px-3.5 py-2.5 bg-chrome-bg border border-chrome-border rounded-lg text-chrome-text outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 text-base transition-all placeholder:text-chrome-muted placeholder:opacity-60'

export function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [email, setEmail] = useState(() => { try { return localStorage.getItem(EMAIL_KEY) || '' } catch { return '' } })
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Start where there is something to type: the password once this device knows the email.
  useEffect(() => { (email ? passwordRef : emailRef).current?.focus() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The hotel login (Sebastian, 2026-11-15): Supabase checks the email and password, not the browser.
  // The session stays on the device until Log out.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setIsSubmitting(true)
    setError(null)
    const { error: failed } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setIsSubmitting(false)
    if (failed) {
      setError(failed.status === 400 ? 'Wrong email or password.' : 'Could not reach the system. Try again.')
      setPassword('')
      passwordRef.current?.focus()
      return
    }
    try { localStorage.setItem(EMAIL_KEY, email.trim()) } catch { /* private window: typed again next time */ }
    onLoginSuccess()
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-chrome-bg font-sans p-4">
      <div className="w-full max-w-sm bg-chrome-raised p-8 rounded-2xl border border-chrome-border shadow-softLg">

        {/* Brand lockup — echoes the logo: gold monogram inside a thin circle,
            white uppercase wordmark beneath. */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-20 h-20 rounded-full border-2 border-gold-400 flex items-center justify-center mb-4">
            <span className="font-display font-extrabold text-2xl tracking-tight text-gold-400">DP</span>
          </div>
          <h2 className="font-display font-extrabold text-xl tracking-[0.18em] text-white">DAWEEZ</h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-chrome-muted mt-1">PENSION HOUSE</p>
          <p className="text-[11px] text-chrome-muted mt-4">Staff PMS Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs text-chrome-muted font-medium">Email</label>
            <input
              id="login-email"
              ref={emailRef}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => { setError(null); setEmail(e.target.value) }}
              disabled={isSubmitting}
              placeholder="e.g. staff@daweez.ph"
              className={BOX}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs text-chrome-muted font-medium">Password</label>
            <input
              id="login-password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setError(null); setPassword(e.target.value) }}
              disabled={isSubmitting}
              placeholder="Enter password"
              className={BOX}
            />
            {error && <p className="text-xs text-danger-300 font-medium mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="w-full py-2.5 bg-gold-400 hover:bg-gold-500 disabled:bg-chrome-border disabled:text-chrome-muted text-ink-900 font-bold text-sm rounded-lg transition-all cursor-pointer"
          >
            {isSubmitting ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function LoginRoute() {
  // A full reload, so the settings read before sign-in (only the website's share) are read again in full.
  return <LoginPortal onLoginSuccess={() => window.location.assign('/calendar')} />
}
