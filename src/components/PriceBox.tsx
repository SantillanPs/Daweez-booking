import React, { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { NumInput } from './NumInput'

/**
 * A price asked for on the spot (the price-on-the-spot mock Sebastian approved, 2026-10-16):
 * a room with no price for what the desk is selling — a short stay's hours, breakfast — no
 * longer greys the choice out and sends them to Settings. The chip opens into this box where it
 * was tapped; Enter or ✓ saves the price on the room, ✕ or Escape puts the chip back.
 */
export function PriceBox({ label, onSave, onBack, className = '' }: {
  /** What is being priced, shown before the ₱ (`3h`, a cup, `Room 7`). */
  label: React.ReactNode
  onSave: (price: number) => void
  onBack: () => void
  className?: string
}) {
  const [price, setPrice] = useState(0)
  const [want, setWant] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => { box.current?.querySelector('input')?.focus() }, [])

  const save = () => {
    if (price > 0) { onSave(price); return }
    // Nothing typed: the box shakes and glows, and the cursor stays in it.
    setWant(true)
    box.current?.animate([{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-5px)' }, { transform: 'none' }], { duration: 400 })
    box.current?.querySelector('input')?.focus()
  }

  return (
    <span ref={box}
      className={'bw-arrive inline-flex items-center gap-1 shrink-0 rounded-full border-[1.5px] border-gold-400 bg-gold-100 pl-3 pr-0.5 text-gold-800 font-bold ' +
        (want ? 'shadow-[0_0_0_3px_rgb(208_171_96/0.35)] ' : '') + className}>
      {label}
      <span className="ml-1">₱</span>
      <NumInput value={price} onChange={n => { setPrice(n); if (n > 0) setWant(false) }} allowDecimal={false} aria-label="Price"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') { e.stopPropagation(); onBack() } }}
        className="w-16 h-7 bg-transparent border-0 outline-none text-[16px] font-bold text-main placeholder:text-gold-400/70" />
      <button type="button" onClick={save} aria-label="Save price"
        className={'w-7 h-7 shrink-0 rounded-full grid place-items-center text-white cursor-pointer transition-[background-color,transform] duration-200 active:scale-90 ' + (price > 0 ? 'bg-emerald-600' : 'bg-ink-900')}>
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
      <button type="button" onClick={onBack} aria-label="Back" className="bw-x w-7 h-7 shrink-0 rounded-full grid place-items-center text-muted hover:text-main cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}
