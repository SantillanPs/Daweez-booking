import { useEffect, useRef, useState } from 'react'

const COUNT_MS = 600

/** A peso amount that counts to its new figure when it changes, so a payment is seen
 *  coming off what is owed. It never counts on first render: a screen that opens shows
 *  what is true, at once. */
export function CountPeso({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    from.current = value
    if (start === value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    const t0 = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const p = Math.min(1, (now - t0) / COUNT_MS)
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className="tabular-nums">₱{shown.toLocaleString()}</span>
}
