# Database history

What was done to the live database by hand, and when. Moved out of `CLAUDE.md` on 2026-10-28 so it does not load into every session; `CLAUDE.md` keeps only what guides the work.

- **Pension House Exclusive** (₱20,000 a day, `venue-exclusive`) is in both databases (`20261006120000_add_pension_house_exclusive_venue.sql`; added to live by hand on 2026-10-06, the owner's go-ahead). Its capacity (50) and photo (the Vacation House's) are placeholders. It is not in the analytics report totals, which name the other three.
- **Venue kinds** (`20261006130000_vacation_house_price_and_types.sql`) were applied to live by hand on 2026-10-13, the owner's go-ahead; the one live booking made at the old ₱15,000 was set to Exclusive so its bill did not change.
- **Live was cleared of everything before 12 Oct 2026** on 2026-10-13 (the owner's ruling): 40 bookings that had ended, 14 order slips with their lines, 2 expenses. A copy is in the live database's `backup_20261013` schema (`bookings`, `tabs`, `tab_lines`, `expenses`), which the app cannot reach.
- **On 2026-10-14 the payments still dated before 13 Oct were cleared from live** (the owner: they showed as fake income on Today's money): the 10 cancelled ANN / ROSE ANN SERING test bookings made before 13 Oct were deleted, and the 4 cancelled ERWIN CAGAMPANG bookings kept with their payments removed. Bookings made from 13 Oct on, and ARIANWEN MIRALLES's real ₱1,250 deposit of 6 Oct, were left alone. The 14 rows as they were are in `backup_20261014.bookings`. Later that day the owner had the rest of those test bookings deleted too: all 6 ERWIN CAGAMPANG bookings (the 2 confirmed venues for 16 Oct as well) and Masaya Trip / ARIANWEN MIRALLES (Room 3, 29–30 Oct), copied into the same backup table first.
- **`money_handovers`** (`20261013120000_money_handovers.sql`) applied to live on 2026-10-13; its `kind = 'in'` (`20261014120000_cash_added.sql`) on 2026-10-14.
- **Institutions** (`20261020120000_institutions.sql`) applied to live on 2026-10-20, the owner's go-ahead.
- **Half-day exclusion constraints** (`20261025120000_short_stay_halves.sql`) applied to live on 2026-10-25, the owner's go-ahead.
- **Cancel note** (`20261029120000_cancel_note.sql`: `bookings.cancel_note`, `cancel_booking(p_booking_id, p_note)`) applied to live on 2026-10-29, the owner's go-ahead.
- **Rescheduled** (`20261029130000_moved_from.sql`: `bookings.moved_from`, `set_booking_moved_from`) applied to live on 2026-10-29, the owner's go-ahead.
- **Early check-out frees the room** (`20261031120000_early_check_out_frees_room.sql`: `booking_halves` takes `actual_check_out`, with `book_booking`, `update_booking` and both exclusion constraints) applied to live on 2026-10-31, the owner's go-ahead.
