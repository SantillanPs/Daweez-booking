# Reports, Settings and channels — why they work this way

## Earnings Report

- **Opens on Spreadsheet and Daily.** The owner: *"make the spreadsheet and daily as the default."*
- **A period means what its chip says.** Daily is one day. It once showed seven, and he asked: *"this is supposed to be daily. why is this doing weekly?"*
- **Restaurant & bar has its own row**, counted on the day each order was placed.
- **The Extras column is a flat amount per group** that staff set in Settings: Rooms + Vacation House share one, Garden + Gazebo share another.
- Words are everyday English: "Total Money In", "Total Money Out", "Your Profit".
- The Daily Report is a print button here, not a page (see [bills-and-paper.md](bills-and-paper.md)).

## The day's money

- **Every day the staff log the day's expenses and print a daily report for the owner:** the money received, the money spent, and what is left at the bottom (the owner, 2026-10-04).
- **The people who log expenses are the staff working in the hotel**, and the old screen felt slow and unpleasant to them: *"you just don't want to use it."* So the day is one screen — type the amount, tap what it was for — with the day's money in, money out and the print button together.

## Settings

- **Three tabs — Rooms & prices · Other charges · Channels — and one save bar** that appears only when something was typed and says how many changes are waiting. It replaced a page with three different ways of saving.
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

- **Four tabs — Front desk · Restaurant · Stock · Money — and a gear for Settings** (the owner, 2026-10-04). There were eight, one per screen; an earlier idea had six (card k75).
- **Each tab opens on the screen staff use most:** Calendar, Orders, Stock room, Today's money. The other screens are small sub-tabs at the top, one tap away.
- **On tablet and phone the bottom bar holds only the four tabs.** Sub-tabs never go inside it.
- Old addresses keep working, and Logout stays apart from the tabs.
- What moved where: Agencies was "Corporate Partners"; Today's money was "Expenses"; the Earnings report was "Analytics"; Stock was "Housekeeping".

## The staff app's look

- Charcoal and gold, taken from the logo. **The working app stays light** — a dark top bar was tried and reverted. Dark is only for the login screen and the public booking page header.
- Gold is too pale to be text on a light background; gold buttons take dark text.
- Built for a desktop screen first, usable on tablet and phone.
- Screens are dense: no wasted space, little scrolling, rare options hidden until needed.
