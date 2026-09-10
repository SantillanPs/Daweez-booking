import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'

interface LoginPortalProps {
  onLoginSuccess: () => void
}

export function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus passcode input field on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const staffPasscode = import.meta.env.VITE_STAFF_PASSCODE

  const validatePasscode = (code: string) => {
    const cleanCode = code.trim()
    const targetCodes = ['daweez2026', '8888', 'daweezpms']
    if (staffPasscode) {
      targetCodes.push(staffPasscode.trim())
    }
    return targetCodes.some(target => cleanCode.toLowerCase() === target.toLowerCase())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passcode) return

    setIsSubmitting(true)
    setError(null)

    setTimeout(() => {
      if (validatePasscode(passcode)) {
        localStorage.setItem('daweez_pms_auth', 'true')
        onLoginSuccess()
      } else {
        setError('Incorrect passcode.')
        setPasscode('')
        if (inputRef.current) inputRef.current.focus()
      }
      setIsSubmitting(false)
    }, 200)
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
            <label className="text-xs text-chrome-muted font-medium">Passcode</label>
            <input
              ref={inputRef}
              type="password"
              value={passcode}
              onChange={(e) => {
                setError(null)
                setPasscode(e.target.value)
              }}
              disabled={isSubmitting}
              placeholder="Enter staff passcode"
              className="w-full px-3.5 py-2.5 bg-chrome-bg border border-chrome-border rounded-lg text-chrome-text outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 text-sm transition-all placeholder:text-chrome-muted placeholder:opacity-60"
            />
            {error && <p className="text-xs text-danger-300 font-medium mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !passcode}
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
  const navigate = useNavigate()
  return (
    <LoginPortal
      onLoginSuccess={() => {
        navigate({ to: '/calendar' })
      }}
    />
  )
}
