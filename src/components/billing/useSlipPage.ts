import { useEffect } from 'react'

const PAPER_MM = 58
const MARGIN_MM = 3
const PX_PER_MM = 96 / 25.4

/**
 * Tells the printer how long a 58 mm slip is, while one is on screen.
 *
 * **The printed receipt came out "extremely long"** (the owner, 2026-10-12). The page
 * used to be asked for as `size: 58mm auto`, which is not a size a browser accepts, so
 * the whole line was thrown away and the slip was printed on whatever paper the printer
 * named — a full-length sheet, fed out blank under the receipt. A roll has no page, so
 * the page is made exactly as long as the slip, measured at the moment of printing (a
 * running tab grows while it is open).
 *
 * The page is set only for the print itself, so the A5 statement keeps its own size.
 */
export function useSlipPage() {
  useEffect(() => {
    const style = document.createElement('style')
    const before = () => {
      const slip = document.querySelector('.print-slip')
      // The slip on screen is the same width as the printed one, so its height is the
      // paper's. A little is added so a rounding never tips the last line onto a new page.
      const long = slip ? Math.ceil(slip.getBoundingClientRect().height / PX_PER_MM) + 2 * MARGIN_MM + 4 : 200
      style.textContent = '@page { size: ' + PAPER_MM + 'mm ' + long + 'mm; margin: ' + MARGIN_MM + 'mm; }'
      document.head.appendChild(style)
    }
    const after = () => style.remove()
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      style.remove()
    }
  }, [])
}
