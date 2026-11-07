import React from 'react'
import { Booking } from '../../types/booking'
import { EXCLUSIVE_ID } from '../../utils/availability'
import { bookingStage } from './bookingStyles'

/**
 * **THE ROOF** (the roof mock, Sebastian, 2026-11-07). Pension House Exclusive is the whole
 * house — every room and every venue — so its pill on the top row hangs a striped roof down
 * over every row below it for its days. Nothing can be sold under it (`no_overlap_exclusive`),
 * and a tap anywhere on it opens the Exclusive's panel.
 *
 * While the Exclusive is being PICKED, the same shape lights every row under the picked days,
 * and whatever is booked there is marked on its pill (`data-taken`) for the action bar to name.
 *
 * Drawn over the table, measured off the pills and cells after every render: a table cannot
 * span one cell down through rows that each have their own cells.
 */
export function ExclusiveRoof({ scrollRef, roofs, pick, taken, onOpen }: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  roofs: Booking[]
  pick: { from: string; to: string } | null
  taken: Booking[]
  onOpen: (b: Booking) => void
}) {
  type Shape = { left: number; top: number; width: number; height: number }
  const [shapes, setShapes] = React.useState<{ roofs: (Shape & { id: string })[]; pick: Shape | null }>({ roofs: [], pick: null })

  const measure = React.useCallback(() => {
    const scroller = scrollRef.current
    const table = scroller?.querySelector('table')
    if (!scroller || !table) return
    const s = scroller.getBoundingClientRect()
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { l: r.left - s.left + scroller.scrollLeft, r: r.right - s.left + scroller.scrollLeft, t: r.top - s.top + scroller.scrollTop, b: r.bottom - s.top + scroller.scrollTop }
    }
    const bottom = box(table).b
    const next = {
      roofs: roofs.flatMap(b => {
        const pill = scroller.querySelector('[data-pill="' + b.id + '"]')
        if (!pill) return []
        const p = box(pill)
        return [{ id: b.id, left: p.l, width: p.r - p.l, top: p.b, height: Math.max(0, bottom - p.b - 4) }]
      }),
      pick: null as Shape | null,
    }
    if (pick) {
      const cell = (iso: string) => scroller.querySelector('[data-unit="' + EXCLUSIVE_ID + '"][data-day="' + iso + '"]') as HTMLTableCellElement | null
      const a = cell(pick.from), z = cell(pick.to)
      if (a && z) {
        // From the afternoon of the first day to the morning of the last, as the stay runs.
        const A = box(a), Z = box(z)
        const left = a.colSpan > 1 ? (A.l + A.r) / 2 : A.l
        const right = z.colSpan > 1 ? (Z.l + Z.r) / 2 : Z.r
        next.pick = { left, width: right - left, top: A.b, height: bottom - A.b }
      }
    }
    setShapes(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
  }, [scrollRef, roofs, pick])

  React.useLayoutEffect(() => { measure() })
  React.useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // What is in the way wears a dashed red edge on its own pill.
  const takenKey = taken.map(b => b.id).join(',')
  React.useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || !takenKey) return
    const pills = takenKey.split(',').map(id => scroller.querySelector('[data-pill="' + id + '"]')).filter((el): el is Element => !!el)
    pills.forEach(el => el.setAttribute('data-taken', ''))
    return () => pills.forEach(el => el.removeAttribute('data-taken'))
  }, [scrollRef, takenKey])

  const PLACE = ' [left:var(--ex-l)] [top:var(--ex-t)] [width:var(--ex-w)] [height:var(--ex-h)]'
  return (
    <>
      {shapes.roofs.map(r => {
        const b = roofs.find(x => x.id === r.id)
        if (!b) return null
        return (
          <button key={r.id} type="button" onClick={() => onOpen(b)} style={{ '--ex-l': r.left + 'px', '--ex-t': r.top + 'px', '--ex-w': r.width + 'px', '--ex-h': r.height + 'px' } as React.CSSProperties}
            title={(b.guest_name || 'Pension House Exclusive') + ' — every room and venue'}
            aria-label={'Pension House Exclusive, ' + (b.guest_name || '') + ' — every room and venue'}
            className={'ex-roof absolute z-[5]' + PLACE + ' rounded-b-lg border-x border-b cursor-pointer transition-[filter] hover:brightness-95 ' +
              (bookingStage(b) === 'in' ? 'ex-in border-emerald-600' : 'border-gold-400')} />
        )
      })}
      {shapes.pick && (
        <div key={pick ? pick.from + pick.to : ''} aria-hidden="true" style={{ '--ex-l': shapes.pick.left + 'px', '--ex-t': shapes.pick.top + 'px', '--ex-w': shapes.pick.width + 'px', '--ex-h': shapes.pick.height + 'px' } as React.CSSProperties}
          className={'ex-pick absolute z-[4]' + PLACE + ' pointer-events-none border-x border-dashed border-gold-400/60 bg-gold-100/60'} />
      )}
    </>
  )
}
