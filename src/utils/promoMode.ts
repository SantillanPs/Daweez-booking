const STORAGE_KEY = 'daweez_promo_active'

export function isPromoActive(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch { return false }
}

export function setPromoActive(v: boolean) {
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch { /* no-op */ }
  // Broadcast so background tabs/portal see it (storage event only fires cross-tab;
  // fire a synthetic same-document event for the local tab).
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: v ? '1' : '0' } as unknown as StorageEventInit))
    window.dispatchEvent(new CustomEvent('promo-toggle', { detail: { active: v } }))
  } catch { /* no-op */ }
}

export function getEffectiveNightlyPrice(
  regular: number,
  promo: number | null | undefined,
  promoOn: boolean,
): number {
  if (promoOn && promo != null && promo > 0) return promo
  return regular
}
