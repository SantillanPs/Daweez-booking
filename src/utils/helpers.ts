// Helper: Generate UUID
export function generateUUID(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
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
