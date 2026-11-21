/**
 * Print on A5 with a zero page margin: the zero box is what stops the browser printing its own
 * date, title and URL across the top of the hotel's paper. Injected for the moment of printing
 * only, and removed when the dialog closes.
 */
export const printA5 = () => printOn('A5')

/** The same on another paper: the Journal is a wide table, printed on A4 sideways. */
export function printOn(size: string) {
  const style = document.createElement('style')
  style.textContent = '@page { size: ' + size + '; margin: 0; }'
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
