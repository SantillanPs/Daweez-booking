import { useEffect, useState } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  /** Verb on the confirming button, e.g. "Delete". */
  confirmLabel?: string
  /** Danger red for destructive actions, gold for everything else. */
  tone?: 'danger' | 'neutral'
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'message'>> {
  id: number
  message?: string
  resolve: (ok: boolean) => void
}

// Same shape as the toast store: one module-level request, one host rendering it.
//
// `askConfirm(...)` replaces `window.confirm(...)`. The browser dialog froze the
// whole app, could not be styled, and said nothing about what was being deleted.
// Here the call site still reads as a single line:
//
//   if (!(await askConfirm({ title: 'Delete this expense?', confirmLabel: 'Delete' }))) return
let nextId = 1
let current: ConfirmRequest | null = null
const listeners = new Set<(r: ConfirmRequest | null) => void>()

function emit() {
  listeners.forEach(l => l(current))
}

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // Only one question at a time: an earlier one resolves as "no" so no caller
  // is left waiting on an answer it will never get.
  if (current) { current.resolve(false); current = null }
  return new Promise<boolean>(resolve => {
    current = {
      id: nextId++,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || 'Confirm',
      tone: options.tone || 'neutral',
      resolve,
    }
    emit()
  })
}

export function resolveConfirm(ok: boolean) {
  const req = current
  if (!req) return
  current = null
  emit()
  req.resolve(ok)
}

export function useConfirmRequest(): ConfirmRequest | null {
  const [req, setReq] = useState<ConfirmRequest | null>(current)
  useEffect(() => {
    listeners.add(setReq)
    return () => { listeners.delete(setReq) }
  }, [])
  return req
}
