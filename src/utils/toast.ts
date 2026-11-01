import { useEffect, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
  /** A word to take it back with, for a change that moved something off the screen. */
  action?: { label: string; run: () => void }
}

// One tiny module-level store, so any screen can say something without a
// provider or a prop drilled through every layer.
//
// Nothing here is a browser alert: `alert()` freezes the whole app until the
// staff member dismisses it, steals focus out of the box they were typing in,
// and gives no hint which action produced it. A toast slides in, says the same
// thing, and lets them keep working.
let nextId = 1
let current: ToastMessage | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<(t: ToastMessage | null) => void>()

function emit() {
  listeners.forEach(l => l(current))
}

/** How long a message stays: errors stay a little longer — they usually need reading twice. */
export const toastMs = (tone: ToastTone, action?: unknown) => action ? 7000 : tone === 'error' ? 5000 : 3200

export function showToast(text: string, tone: ToastTone = 'success', action?: ToastMessage['action']) {
  const id = nextId++
  current = { id, text, tone, action }
  emit()
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    if (current && current.id === id) {
      current = null
      emit()
    }
  }, toastMs(tone, action))
}

/** Takes a message off at once: its action has been pressed. */
export function closeToast() {
  current = null
  emit()
}

export function useToastMessage(): ToastMessage | null {
  const [msg, setMsg] = useState<ToastMessage | null>(current)
  useEffect(() => {
    listeners.add(setMsg)
    return () => { listeners.delete(setMsg) }
  }, [])
  return msg
}
