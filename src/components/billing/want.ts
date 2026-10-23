// What is missing glows gold and shakes, and gets the cursor (the Receive box's `want`).
export const want = (el: HTMLElement | null) => {
  if (!el) return
  el.classList.remove('bw-want', 'bw-nope'); el.getBoundingClientRect(); el.classList.add('bw-want', 'bw-nope')
  ;(el.matches('input') ? el : el.querySelector('input'))?.focus()
}
