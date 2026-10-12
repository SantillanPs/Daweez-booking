import { useEffect } from 'react'

/**
 * Prints the slip that is on screen, and only it, at the top of the printer's own paper.
 *
 * **The slip is printed from a COPY put straight under `<body>`** (the owner, 2026-10-12).
 * It used to be printed where it stood, pinned to the page — but it stands inside
 * whatever opened it (the booking's panel, the booking form), and what is around it
 * decided where it landed.
 *
 * **No page size is asked for.** A size the printer does not have is not used as the
 * paper: the browser draws that page in the MIDDLE of the printer's real paper instead.
 * On the owner's printer the receipt came out small in the middle of an A5 sheet; on the
 * hotel's roll, whose paper is very long, the middle is far down it, so the receipt came
 * out blank. The copy is as wide as the paper the printer names (48 mm on the hotel's)
 * and starts at its top; how long the paper is fed is the printer's own setting.
 */
export function useSlipPage() {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@page { margin: 0; }'
    let root: HTMLDivElement | null = null
    const after = () => { root?.remove(); root = null; style.remove() }
    const before = () => {
      after()
      const slip = document.querySelector('.print-slip')
      if (!slip) return
      root = document.createElement('div')
      root.className = 'print-root'
      root.appendChild(slip.cloneNode(true))
      document.body.appendChild(root)
      document.head.appendChild(style)
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [])
}
