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
    <div className="min-h-screen w-full flex items-center justify-center bg-softbg font-sans p-4">
      <div className="w-full max-w-sm bg-card p-8 rounded-lg border border-soft shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-main">Daweez Pension House</h2>
          <p className="text-xs text-muted mt-1">Staff PMS Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Passcode</label>
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
              className="w-full px-3.5 py-2.5 bg-page border border-soft rounded-lg text-main outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 text-sm transition-all placeholder:text-muted placeholder:opacity-50"
            />
            {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-2.5 bg-brand-primary hover:bg-[#a27e43] disabled:bg-softbg disabled:text-muted text-white font-medium text-sm rounded-lg transition-all cursor-pointer"
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
