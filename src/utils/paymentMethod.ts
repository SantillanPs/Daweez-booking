// One place that decides what a payment method is. Matching must be by whole
// word, never by substring: `'gcash'.includes('cash')` is true, which used to
// tick "Cash" on every GCash booking and print the wrong method (and the wrong
// account details) on receipts.

export type PaymentKind = 'cash' | 'gcash' | 'bank' | 'check' | 'other'

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
  // A **check** is its own way to pay (the owner, 2026-09: the hotel's real PGO bill names
  // `Bank Transfer / Cash / Check`). It carries no reference number, like cash.
  if (parts.includes('check') || parts.includes('cheque')) return 'check'
  if (parts.includes('cash')) return 'cash'
  return 'other'
}

// The plain label staff and guests both recognise.
export function paymentMethodLabel(method?: string): string {
  const raw = (method || '').trim()
  const kind = paymentKind(raw)
  if (kind === 'gcash') return 'GCash'
  if (kind === 'bank') return 'Bank Transfer'
  if (kind === 'check') return 'Check'
  if (kind === 'cash') return 'Cash'
  return raw || 'Cash'
}

// Only GCash and bank payments carry a reference number worth printing.
export function methodNeedsReference(method?: string): boolean {
  const kind = paymentKind(method)
  return kind === 'gcash' || kind === 'bank'
}

// The bank's name as it fits on paper (card k144). A statement's tick list only needs the
// name a guest recognises; the **full** name still prints in Account Details underneath,
// which is where anyone actually reads it to make the transfer. The rule exists because
// `Bank of the Philippine Islands (BPI) Transfer` wrapped across **four lines** in the tick
// list and cost the page 66px — enough to push the Pension Policies off the sheet. A name
// that already fits (`Land Bank`) is left completely alone.
export function shortBankName(name?: string): string {
  const raw = (name || '').trim()
  if (!raw) return 'Bank'
  const acronym = (raw.match(/\(([^)]+)\)/) || [])[1]
  const plain = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (plain && plain.length <= 14) return plain
  if (acronym && acronym.trim()) return acronym.trim()
  return plain.split(' ')[0] || 'Bank'
}
