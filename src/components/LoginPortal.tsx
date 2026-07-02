import React, { useState, useEffect, useRef } from 'react'
import { Key, Lock, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface LoginPortalProps {
  onLoginSuccess: () => void
}

export function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isShaking, setIsShaking] = useState(false)
  const [showPasscode, setShowPasscode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Allowed staff passcodes
  const staffPasscode = import.meta.env.VITE_STAFF_PASSCODE

  const validatePasscode = (code: string) => {
    const cleanCode = code.trim()
    const targetCodes = ['daweez2026', '8888', 'daweezpms']
    if (staffPasscode) {
      targetCodes.push(staffPasscode.trim())
    }
    return targetCodes.some(target => cleanCode.toLowerCase() === target.toLowerCase())
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!passcode) return

    setIsSubmitting(true)
    setError(null)

    // Premium micro-delay simulation for verification feedback
    setTimeout(() => {
      if (validatePasscode(passcode)) {
        localStorage.setItem('daweez_pms_auth', 'true')
        onLoginSuccess()
      } else {
        setError('Invalid passcode. Access Denied.')
        setIsShaking(true)
        setPasscode('')
        if (inputRef.current) inputRef.current.focus()
        setTimeout(() => setIsShaking(false), 500)
      }
      setIsSubmitting(false)
    }, 400)
  }

  const handleKeypadPress = (val: string) => {
    setError(null)
    if (val === 'clear') {
      setPasscode('')
    } else if (val === 'delete') {
      setPasscode(prev => prev.slice(0, -1))
    } else {
      if (passcode.length < 16) {
        setPasscode(prev => prev + val)
      }
    }
    if (inputRef.current) inputRef.current.focus()
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 font-sans overflow-hidden">
      {/* Premium Luxury Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#B89251]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#9A783E]/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-[#B89251]/5 blur-[90px] pointer-events-none" />

      {/* Glassmorphism Portal Card Container */}
      <div 
        className={`relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl shadow-black/80 transition-all duration-300 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#B89251] to-[#9A783E] rounded-2xl shadow-lg shadow-[#B89251]/20 mb-4 animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Daweez Pension House</h2>
          <p className="text-[10px] text-[#B89251] font-bold tracking-widest uppercase mt-1">Staff Portal & PMS Access</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Enter Staff Passcode
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                ref={inputRef}
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setError(null)
                  setPasscode(e.target.value)
                }}
                disabled={isSubmitting}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-950/70 border border-slate-800 focus:border-[#B89251]/80 rounded-xl text-center font-mono text-lg text-white tracking-widest outline-none transition-all duration-200 placeholder-slate-700 focus:ring-1 focus:ring-[#B89251]/30"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-[#B89251] transition-colors duration-250"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error Message */}
            <div className="h-5 flex items-center justify-center">
              {error && (
                <div className="flex items-center space-x-1.5 text-xs text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Numeric PIN Pad (Optimized for PMS tablets & mobile check-ins) */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                disabled={isSubmitting}
                className="py-3.5 rounded-xl bg-slate-950/30 hover:bg-slate-900/80 active:bg-slate-950 border border-slate-900/60 hover:border-slate-800 text-white font-semibold text-lg flex items-center justify-center transition-all duration-150 select-none cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('clear')}
              disabled={isSubmitting}
              className="py-3.5 rounded-xl bg-slate-950/20 hover:bg-slate-900/50 active:bg-slate-950 border border-transparent text-slate-400 font-medium text-xs flex items-center justify-center transition-all duration-150 select-none cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              disabled={isSubmitting}
              className="py-3.5 rounded-xl bg-slate-950/30 hover:bg-slate-900/80 active:bg-slate-950 border border-slate-900/60 hover:border-slate-800 text-white font-semibold text-lg flex items-center justify-center transition-all duration-150 select-none cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('delete')}
              disabled={isSubmitting}
              className="py-3.5 rounded-xl bg-slate-950/20 hover:bg-slate-900/50 active:bg-slate-950 border border-transparent text-slate-400 font-medium text-xs flex items-center justify-center transition-all duration-150 select-none cursor-pointer"
            >
              Delete
            </button>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-3.5 bg-gradient-to-r from-[#B89251] to-[#9A783E] hover:from-[#cda561] hover:to-[#ae8b4b] disabled:from-slate-800/50 disabled:to-slate-800/50 disabled:text-slate-500 text-white font-semibold text-sm rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 shadow-md shadow-[#B89251]/10 disabled:shadow-none cursor-pointer"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Verify Access</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-500 border-t border-slate-900 pt-4">
          <p className="flex items-center justify-center space-x-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Secured Session Mode</span>
          </p>
        </div>
      </div>
    </div>
  )
}
