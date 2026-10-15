import { useEffect, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
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
export const toastMs = (tone: ToastTone) => tone === 'error' ? 5000 : 3200

export function showToast(text: string, tone: ToastTone = 'success') {
  const id = nextId++
  current = { id, text, tone }
  emit()
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    if (current && current.id === id) {
      current = null
      emit()
    }
  }, toastMs(tone))
}

export function useToastMessage(): ToastMessage | null {
  const [msg, setMsg] = useState<ToastMessage | null>(current)
  useEffect(() => {
    listeners.add(setMsg)
    return () => { listeners.delete(setMsg) }
  }, [])
  return msg
}
