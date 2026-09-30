# Settings (src/components/settings) AGENTS.md

## Purpose

The pieces of the Settings screen: the three tabs' contents — the room price cards, the breakfast menu the daily board reads, every non-room charge, and the channel feed links — plus the draft model one save bar writes from.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: `src/components/settings/**`. The screen that assembles them is `src/components/SettingsTab.tsx` (see `src/components/AGENTS.md`).

## Local Contracts

    - [roomDraft.ts](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/components/settings/roomDraft.ts) — `RoomDraft` (a room's night, breakfast and three short-stay figures) and `roomDraft(room, edits)`, which lays whatever staff have typed over the room's live values. Only the rooms in the edit map are being changed; every other room falls through to its stored figures, so one save keeps the whole page true. It sits in its own module because a file exporting both components and plain functions breaks React Fast Refresh. **A room has ONE price** (card k128): the caller writes the same figure into both stored columns, so nothing can read the stale one.

    - [RoomRatesEditor.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/components/settings/RoomRatesEditor.tsx) — the rooms, in the shape the owner picked after **six** drawings (2026-09, "design 6"): **a price list on the left and a small panel on the right that follows whichever room you click.** Every room and its night price are on one screen (`Room 2 · Full Double  ₱950`), the selected row carries a gold left edge, and **nothing pops over the list, no row grows and no space is left empty** — that was the whole fault of the card grid before it, where one open card stretched its entire row and left the other cards as empty boxes. The panel shows the chosen room's number and name, then *Overnight* (a night, breakfast once for the stay) and *Short stay* (3, 6, 12 hours), with **22 hours stated as the night price rather than offered as a fourth box**. A room with typing waiting shows a small gold dot; there is **no Save button here** — the page has one save bar, so this component is controlled (`edits` + `onEdit`) and the parent owns the draft. The owner also asked for the label widths to stay short and the values to sit in their own boxes: no wall of beige rows.

    - [BreakfastMenuEditor.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/components/settings/BreakfastMenuEditor.tsx) — the breakfast menu: what the **daily breakfast board** offers each morning (dish + price, add and remove). It is **not** the price of breakfast — a stay pays for breakfast **once at booking, at the room's own breakfast price** (card k140), and the daily record charges nothing; the caption on the card says exactly that.

    - [OtherCharges.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/components/settings/OtherCharges.tsx) — every figure that is not a room's own price, **one card per kind of money** in the order the desk meets it: **Venues** (Vacation House hourly, Gazebo/Garden block hours and price), **Arrival & departure** (standard times, early/late per hour and the cap, the security deposit), **Things guests can add** (foam/pillow/blanket/towel per night, mineral water and the event pieces), **Where guests pay** (a GCash block and **two** Bank blocks — the second account (Land Bank · Jonathan E. Dango) exists because the hotel's own agency bill lists both banks; the agency statement prints them both, the ordinary one prints only the account matching the method chosen — each value on its own full-width line so nothing is cut off), and — last and clearly apart — **“For the Earnings Report only — these never appear on a bill”**. That last card exists because those two figures used to sit among real prices and looked like something a guest is charged.

    - [ChannelFeeds.tsx](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/components/settings/ChannelFeeds.tsx) — **the iCal connections**: a switch for the whole connection in the card header, a switch on every room row, and the import/export links behind each row. One expandable row per room holds its **export URL**, the **Airbnb** and **Booking.com** import boxes and a copy button on each; the URLs keep **their own Save feed URLs button**, because they are a different job from the rates and are not part of the money save bar. `fullList(rooms, feeds)` builds a row for both channels even when no feed has ever been stored. **The switches were the owner's ask** (2026-09-30: *"can we have a toggle to turn enable and disable ical connections?"*, and on the drawn pair: *"do it"*) — drawn first, as everything is. **They save the moment they are thrown**, not behind the URLs' button: an on/off is a decision the desk wants to see take effect, and a refused save **puts the switch back and says so** through `showToast`, so the screen can never show an off connection that is still running. The per-room switch shows the room's own setting and is **disabled while the master is off** (nothing syncs anyway), and the status word reads `Synced` / `Off`. **The switch sits OUTSIDE the row's expander** — a button inside a button is invalid HTML, and throwing a room's switch must never also open its boxes, so the row header is a flex div holding an expand button, the switch and the chevron. Its state lives in `utils/channelSync.ts`; the `sync-ical` edge function reads the same row, which is what makes the switch real.

## Work Guidance

- **One save bar, three tabs** (the owner's ruling, 2026-09): `SettingsTab` holds the draft (`rates`, `pay`, per-room edits) and saves it in one press. The bar appears **only when something has been typed** and says how many changes are waiting — `countDiffs` counts the changed fields, so the number is real.
- **Keep the labels plain and the values whole.** No accounting words, and never a box too narrow for the thing it holds (the payment card was rebuilt for exactly this: five half-width boxes with `0910…` in them told staff nothing).

## Verification

- `npx tsc -b --force` and `npm run lint` (see the root `AGENTS.md`).

## Child DOX Index

None.
