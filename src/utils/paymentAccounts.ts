import { PaymentAccounts } from '../types/booking'
import { readAppSetting, writeAppSetting } from './appSettings'

// Where the guest sends a downpayment. Defaults match the official Daweez
// Pension House form; staff/admin can edit these in Settings → Other charges.
export const DEFAULT_PAYMENT_ACCOUNTS: PaymentAccounts = {
  gcashName: 'Narlina D.',
  gcashNumber: '0910-7934988',
  bankName: 'Bank of the Philippine Islands (BPI)',
  bankAccountName: 'DAWEEZ PENSION HOUSE',
  bankAccountNumber: '5636-0544-12',
  // The second account the hotel's own PGO bill lists (the owner, 2026-09).
  bank2Name: 'Land Bank of the Philippines (LB)',
  bank2AccountName: 'JONATHAN E. DANGO',
  bank2AccountNumber: '0795-0035-25',
}

const KEY = 'payment_accounts'

// Held in memory for this session. The database is the home; this cache exists
// because the printed statements, the guest portal and the chatbot read these
// synchronously. `hydratePaymentAccounts()` fills it before anything renders.
let cache: PaymentAccounts | null = null

/**
 * Reads where guests pay out of the database into memory.
 *
 * Needed before anything renders: the guest portal and the printed bill both
 * quote these figures, and telling a guest to send money to a stale account is
 * worse than refusing to show the page.
 */
export async function hydratePaymentAccounts(): Promise<void> {
  const stored = await readAppSetting<Partial<PaymentAccounts>>(KEY)
  cache = stored ? { ...DEFAULT_PAYMENT_ACCOUNTS, ...stored } : { ...DEFAULT_PAYMENT_ACCOUNTS }
}

export function getPaymentAccounts(): PaymentAccounts {
  return cache ? { ...cache } : { ...DEFAULT_PAYMENT_ACCOUNTS }
}

/** Saves where guests pay to the database. Throws when it refuses. */
export async function savePaymentAccounts(accounts: PaymentAccounts): Promise<void> {
  const clean = { ...accounts }
  await writeAppSetting(KEY, clean)
  cache = clean
}
