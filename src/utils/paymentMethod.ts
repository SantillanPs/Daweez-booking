// One place that decides what a payment method is. Matching must be by whole
// word, never by substring: `'gcash'.includes('cash')` is true, which used to
// tick "Cash" on every GCash booking and print the wrong method (and the wrong
// account details) on receipts.

export type PaymentKind = 'cash' | 'gcash' | 'bank' | 'other'

// Split a label into words so 'Bank Transfer' can't match 'cash' and 'GCash'
// can't match 'cash'.
function words(value: string): string[] {
  return (value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function paymentKind(method?: string): PaymentKind {
  const parts = words(method || '')
  if (parts.includes('gcash') || parts.includes('g-cash')) return 'gcash'
  if (parts.includes('bank') || parts.includes('transfer')) return 'bank'
  if (parts.includes('cash')) return 'cash'
  return 'other'
}

// The plain label staff and guests both recognise.
export function paymentMethodLabel(method?: string): string {
  const raw = (method || '').trim()
  const kind = paymentKind(raw)
  if (kind === 'gcash') return 'GCash'
  if (kind === 'bank') return 'Bank Transfer'
  if (kind === 'cash') return 'Cash'
  return raw || 'Cash'
}

// Only GCash and bank payments carry a reference number worth printing.
export function methodNeedsReference(method?: string): boolean {
  const kind = paymentKind(method)
  return kind === 'gcash' || kind === 'bank'
}
