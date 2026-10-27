import { useEffect } from 'react'

// What is missing glows gold and shakes, and gets the cursor (the Receive box's `want`).
export const want = (el: HTMLElement | null) => {
  if (!el) return
  el.classList.remove('bw-want', 'bw-nope'); el.getBoundingClientRect(); el.classList.add('bw-want', 'bw-nope')
  ;(el.matches('input') ? el : el.querySelector('input'))?.focus()
}

/** Focused a frame late: a floating box opens hidden while it finds its place, and a hidden box takes no focus. */
export function useLateFocus(el: React.RefObject<HTMLInputElement | null>, when: unknown = true) {
  useEffect(() => {
    if (!when) return
    const f = requestAnimationFrame(() => el.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(f)
  }, [el, when])
}
