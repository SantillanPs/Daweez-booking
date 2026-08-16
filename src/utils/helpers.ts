// Helper: Generate UUID
export function generateUUID(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Helper: Real RFC-4122 UUID (for Supabase UUID primary keys)
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Helper: Is this string a valid UUID (the DB id column is UUID-typed)?
export function isValidUUID(id: string | undefined | null): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

// Helper: Normalize Venue ID
export function normalizeVenueId(vid: string | undefined | null): string | undefined {
  if (!vid) return undefined
  if (vid.startsWith('venue-')) return vid
  const lower = vid.toLowerCase()
  if (lower.includes('vacation')) return 'venue-vacation'
  if (lower.includes('garden')) return 'venue-garden'
  if (lower.includes('gazebo')) return 'venue-gazebo'
  return vid
}
