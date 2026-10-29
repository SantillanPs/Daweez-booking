import { AppliedDiscount } from '../types/booking'

/**
 * **A bill's discounts, as a list** (Sebastian, 2026-10-29: "I should be able to add more than 1
 * discount", each with a note). `applied_discount` held one before; a row saved since holds a list.
 * The list keeps its places even where a room's share of a flat amount is 0, so the same place is the
 * same discount on every room of the bill (the statement joins the rooms' rows by it).
 */
export function discountsOf(v: AppliedDiscount | AppliedDiscount[] | null | undefined): AppliedDiscount[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/**
 * What each discount takes off a stay costing `subtotal`, in the list's order. Each percentage is of
 * the stay itself, not of what the others leave; together they never take off more than the stay.
 */
export function discountOffs(list: AppliedDiscount[], subtotal: number): number[] {
  let left = Math.max(0, subtotal)
  return list.map(d => {
    const v = Number(d.value) || 0
    if (v <= 0) return 0
    const off = Math.min(left, d.type === 'percent' ? Math.round(subtotal * v / 100) : v)
    left -= off
    return off
  })
}

/** The words on the bill and the paper: `Senior citizen (20%)`, or `Discount` when it has no note. */
export function discountLabel(d: AppliedDiscount): string {
  const name = d.note?.trim() || 'Discount'
  return d.type === 'percent' ? name + ' (' + d.value + '%)' : name
}
