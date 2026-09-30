import { readAppSetting, writeAppSetting } from './appSettings'

/**
 * **The iCal switches** (the owner's design, 2026-09-30: *"can we have a toggle to turn enable and disable ical
 * connections?"*, and on the two drawn switches: *"do it"*).
 *
 * Two switches in one setting, on purpose:
 *
 *   `enabled` — the master one, for the whole channel connection.
 *   `rooms`   — the rooms taken OFF, e.g. `{ "room-3": false }`.
 *
 * **A room that is absent from `rooms` is ON.** Storing the exceptions rather than the whole list keeps the
 * setting tiny and means a newly added room is connected the moment it exists, instead of silently sitting
 * switched off because nobody added it here.
 *
 * It lives in the database (`app_settings`, key `channel_sync`) rather than in the browser, like the rates and
 * where-guests-pay: the desk may switch a room off on one PC, and a second PC must not keep syncing it. **The
 * `sync-ical` edge function reads the same row**, which is what makes the switch real — the fetching happens on
 * the server, so a client-side check alone could be skipped by an old tab left open on another machine.
 *
 * `getChannelSync` is synchronous, served from the in-memory copy that `hydrateChannelSync` fills once before
 * any route renders (`router.tsx`, beside `hydrateRateConfig` and `hydratePaymentAccounts`), so every screen can
 * read the switches while it paints.
 */

export interface ChannelSyncSettings {
  /** The master switch. `false` stops all channel fetching. */
  enabled: boolean
  /** Rooms switched OFF. A room that is absent here is ON. */
  rooms: Record<string, boolean>
}

const DEFAULTS: ChannelSyncSettings = { enabled: true, rooms: {} }

/** The in-memory copy every reader uses. Never written directly — go through save/hydrate. */
let current: ChannelSyncSettings = { ...DEFAULTS }

/** Normalizes whatever the database holds into a shape the rest of the app can trust. */
function tidy(value: Partial<ChannelSyncSettings> | null | undefined): ChannelSyncSettings {
  const rooms: Record<string, boolean> = {}
  const raw = value?.rooms
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([roomId, on]) => {
      // Only the OFF rooms are worth storing; an explicit `true` is the same as absent.
      if (on === false) rooms[roomId] = false
    })
  }
  // Anything that is not an explicit `false` means ON — a missing row, a half-written
  // setting or a value from a future version must never leave the hotel silently un-synced.
  return { enabled: value?.enabled !== false, rooms }
}

/** The switches as they stand. Synchronous — safe to call while rendering. */
export function getChannelSync(): ChannelSyncSettings {
  return current
}

/** Reads the switches out of the database once, before any route renders. */
export async function hydrateChannelSync(): Promise<void> {
  current = tidy(await readAppSetting<ChannelSyncSettings>('channel_sync'))
}

/** Writes the switches. Throws when the database refuses, so the screen reports it instead of looking saved. */
export async function saveChannelSync(next: ChannelSyncSettings): Promise<void> {
  const clean = tidy(next)
  await writeAppSetting('channel_sync', clean)
  current = clean
}

/** True when the master switch is on. */
export function isChannelSyncOn(): boolean {
  return current.enabled
}

/**
 * True when this room's feed should be fetched.
 *
 * One rule for every reader, so the switch on the Settings screen and the edge function's own check can never
 * mean different things: the master must be on, and the room must not be one of the exceptions.
 */
export function isRoomSynced(roomId: string): boolean {
  return current.enabled && current.rooms[roomId] !== false
}
