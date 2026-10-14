# Reports, Settings and channels — why they work this way

## Earnings Report

- **Opens on Spreadsheet and Daily.** The owner: *"make the spreadsheet and daily as the default."*
- **A period means what its chip says.** Daily is one day. It once showed seven, and he asked: *"this is supposed to be daily. why is this doing weekly?"*
- **Restaurant & bar has its own row**, counted on the day each order was placed.
- **The Extras column is a flat amount per group** that staff set in Settings: Rooms + Vacation House share one, Garden + Gazebo share another.
- Words are everyday English: "Total money in", "Total expenses", "Profit".
- **It is drawn like Today's money** (2026-10-13). The owner: *"it looks so out of place with the rest of the system."* A title with the dates under it, one white card, the same Summary bar; black figures, green only for money earned, red for expenses, a dash where a place earned nothing. Table / Charts is a switch beside the period in both views; under the card are a pending-bookings switch (only while a booking is not yet confirmed) and a Print daily report button (he asked to "do something with" the three quiet links, 2026-10-14).
- **The table became a list** (2026-10-14). The owner found the grid *"messy and too plain"*: each place filled one column, so most of it was dashes and the venues sat under "Room rate". Now Profit, Money in and Spent sit at the top as on Charts, then each place in one fixed order (Pension, Restaurant & bar, Vacation House, Garden, Gazebo — he moved the Vacation House below the restaurant) with a long green bar and its share, Spent always in red, the kinds of money only under the place that has them. A place that earned nothing keeps its row. No ▲/▼ here (*"I prefer without"*). It is drawn as a ledger (2026-10-14, chosen from a mock after the full-width list was *"a bit hard to read"*): a line between places, the kinds of money as tags under the name, every amount in one green column, and a short share bar out of 100% beside it.
- **The table and the charts stay two views** (the owner, 2026-10-13, after seeing them merged: *"okay, keep them separate"*). Charts is one card: a column for each day in one gold, a list of bars for where the money came from, longest first, and the same Summary bar. One day has nothing to compare, so only the bars show.
- **The Charts view became a performance page** (2026-10-14, reviewed comment by comment on a mock). The owner wants to see whether the hotel is rising, steady or falling: one big figure (Profit, or the room or venue tapped), a chart that is the main point of the page, spanning exactly the period's lowest to highest point, with a moving-average line, and every room, venue and the restaurant as a tile read like a stock watchlist (green ▲ / red ▼ and a small line). Periods end at today: 30 days, This year, All time, Custom. He was firm that it carries **no words that judge the figures** (*"the owners … know when something is doing well and doing bad"*) and no text-heavy parts. **The chart counts income only** (*"why is it counting losses? it's only supposed to count income"*): it shows Money in or Rooms filled, never expenses; the profit is only the big figure. **Every ▲/▼ is a quick trend** (2026-10-14): the latest day, week or month against the one before it, in whatever the chosen period is drawn in.
- The Daily Report is a print button here, not a page (see [bills-and-paper.md](bills-and-paper.md)).

## The day's money

- **Every day the staff log the day's expenses and print a daily report for the owner:** the money received, the money spent, and what is left at the bottom (the owner, 2026-10-04).
- **The money carries over from one day to the next, like a balance in the hotel** (Sebastian, 2026-10-13: *"it should continue till tomorrow. so if the hotel earned 10k after expenses, then it should still be there tomorrow."*). The bottom of the screen and of the printed sheet is what was left from the day before, this day's money in less money out, and the money in the hotel now. It counts from the first payment ever recorded.
- **The staff hand the money they collected over to the owner** (Sebastian, 2026-10-13: *"the staff or the owner usually do some remittance with the money"*). It comes off the money in the hotel, but it is not an expense, so the earnings report does not count it. It happens rarely (*"the remittance usually happens rarely, so can you apply contextual design?"*), so "Hand over money" is a quiet link under the day, and the gold "Handed over" line shows only on a day it happened. The window asks three things, his own cut of the first drawing: how much, handed over by, notes. Still to ask the staff: whether they hand over cash only (then the balance should count cash only).
- **"All expenses" shows a week, month or year** (no day: the screen already is the day) (Sebastian, 2026-10-14, chosen from a mock over repeating expenses): what went out in total, a bar for each kind of expense biggest first, then the list. It opens on the month around the day on screen, and the arrows step back and forth. The day screen itself stays as it is.
- **The staff can add cash on hand** (Sebastian, 2026-10-14, the day they began using it for real: *"they have cash on hand in the hotel, so they want to add it to the today's money but there's no option"*). It is a hand-over the other way round: it adds to the money in the hotel, is never income, and shows as "Add: Cash added" only on its day. A quiet link beside "Hand over money".
- **The summary at the bottom of the day is the staff's own, copied from the sheet they write by hand** (their paper, 2026-10-13): Cash for Today · Add: Cash Balance Forwarded · Cash on Hand · Less: Cash Remitted and expenses · Total Cash on Hand. They asked for it in the bar under the day's money, where the three carried-over lines were. Expenses and a remittance each get a line of their own so the figures can be checked.
- **The people who log expenses are the staff working in the hotel**, and the old screen felt slow and unpleasant to them: *"you just don't want to use it."* So the day is one screen — type the amount, tap what it was for — with the day's money in, money out and the print button together.

## Settings

- **Three tabs — Rooms & prices · Other charges · Channels — and one save bar** that appears only when something was typed and says how many changes are waiting. It replaced a page with three different ways of saving.
- **A fourth tab, Email, says how to connect the hotel's Gmail** — asked for on 2026-10-04, *"so that staff can know how to set it up"*, when receipts and statements became emailable.
- **Room prices: a list on the left, a panel on the right that follows the room you click.** Chosen after six drawings; the earlier card grid left empty boxes.
- **"Where guests pay" has GCash and two bank accounts**, because the hotel's agency bill lists both banks.
- **Two figures are marked "For the Earnings Report only — these never appear on a bill"**, because they used to sit among real prices and looked like charges.
- **Settings are stored in the database, not the browser.** They once lived in one browser only: a second PC showed factory defaults, and the account a guest was told to pay into could differ from the one on their bill.
- If the database cannot be reached the app stops with a plain message, so no screen quotes default prices.

## Nothing in the browser

**The database is the only home for hotel data** (ruled 2026-09-28). A browser copy once made a refused save look successful — the hotel's room prices were typed, shown on every screen, and never actually saved. A save that fails now says so. The one exception is the staff login session.

## Airbnb / Booking.com calendar links

- Calendars sync in the background every 5 minutes, with a manual button as backup.
- **A master switch and one switch per room.** The owner asked for a toggle to turn the connections on and off. The switch is enforced on the server, so an old tab on another PC cannot sync a room that was switched off.
- **One calendar address lives on one room.** The same Airbnb address was once on nine rooms, so one Airbnb stay blocked nine rooms for the same night. The screen refuses a repeat and names the rooms.
- An empty link box is not saved at all — empty rows used to make the screen look connected to Booking.com when it was not.
- A calendar event that clashes with an existing booking is skipped, never forced in.

## The tabs

- **Four tabs — Front desk · Restaurant · Stock · Cash Flow (renamed from Money by the owner, 2026-10-14) — and a gear for Settings** (the owner, 2026-10-04). There were eight, one per screen; an earlier idea had six (card k75).
- **Each tab opens on the screen staff use most:** Calendar, Orders, Stock room, Today's money. The other screens are small sub-tabs at the top, one tap away.
- **On tablet and phone the bottom bar holds only the four tabs.** Sub-tabs never go inside it.
- Old addresses keep working, and Logout stays apart from the tabs.
- What moved where: Agencies was "Corporate Partners"; Today's money was "Expenses"; the Earnings report was "Analytics"; Stock was "Housekeeping".

## What's new

- **The staff are told what changed after every update to the live system, on the Front desk.** Sebastian, 2026-10-05, the day the kitchen screen went live: *"can you add a what's new after every update we make on the live? make sure it's in the front desk."*
- It opens by itself once on each device, at the front desk, because the staff do not go looking for a change they have not been told about; and it stays behind a button, because they share devices and swap places, so whoever missed it can still read it.
- **The button sits beside Sync in the top bar.** It was first put at the top of the calendar; he had it moved the same day: *"move the button next to the sync button."*

## The staff app's look

- Charcoal and gold, taken from the logo. **The working app stays light** — a dark top bar was tried and reverted. Dark is only for the login screen and the public booking page header.
- **The hotel's own mark, a gold DP in a ring, is the logo at the top left.** Sebastian, 2026-10-05, handing over the picture: *"use this as the logo on the top left."*
- Gold is too pale to be text on a light background; gold buttons take dark text.
- Built for a desktop screen first, usable on tablet and phone.
- Screens are dense: no wasted space, little scrolling, rare options hidden until needed.
