/**
 * Print on A5 with a zero page margin: the zero box is what stops the browser printing its own
 * date, title and URL across the top of the hotel's paper. Injected for the moment of printing
 * only, and removed when the dialog closes.
 */
export function printA5() {
  const style = document.createElement('style')
  style.textContent = '@page { size: A5; margin: 0; }'
  document.head.appendChild(style)
  const done = () => {
    style.remove()
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
  // Backstop: some browsers never fire afterprint.
  window.setTimeout(done, 60000)
}
