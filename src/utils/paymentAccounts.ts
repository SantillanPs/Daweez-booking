import { PaymentAccounts } from '../types/booking'

// Where the guest sends a downpayment. Defaults match the official Daweez
// Pension House form; staff/admin can edit these in Settings → Rates.
export const DEFAULT_PAYMENT_ACCOUNTS: PaymentAccounts = {
  gcashName: 'Narlina D.',
  gcashNumber: '0910-793498',
  bankName: 'BPI',
  bankAccountName: 'DAWEEZ PENSION HOUSE',
  bankAccountNumber: '5636-0544-12',
}

const KEY = 'l_etoile_payment_accounts_db'

export function getPaymentAccounts(): PaymentAccounts {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PaymentAccounts>
      return { ...DEFAULT_PAYMENT_ACCOUNTS, ...parsed }
    }
  } catch { /* invalid stored value → defaults */ }
  return { ...DEFAULT_PAYMENT_ACCOUNTS }
}

export function savePaymentAccounts(accounts: PaymentAccounts): void {
  localStorage.setItem(KEY, JSON.stringify(accounts))
}
