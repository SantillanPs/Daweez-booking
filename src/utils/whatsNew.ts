/**
 * What changed for the staff, each time the live system is updated (Sebastian,
 * 2026-10-05: *"can you add a what's new after every update we make on the live? make
 * sure it's in the front desk"*).
 *
 * **Every update that goes live adds one entry at the top of `UPDATES`, in the same push
 * to `main`.** The staff read it, so it says what they can now do and on which screen, in
 * plain everyday English — never what was changed in the code. A change they cannot see
 * (tidying, a database-only fix) needs no entry.
 *
 * The Front desk shows it (`components/WhatsNew.tsx`).
 */
export interface Update {
  /**
   * The day it went live, `YYYY-MM-DD`. A second update on the same day adds a letter
   * (`2026-10-05b`), so every entry sorts after the one before it.
   */
  id: string
  /** What changed, under the screen it changed on. */
  changes: { where: string; what: string[] }[]
}

/** Newest first. */
export const UPDATES: Update[] = [
  {
    id: '2026-10-06g',
    changes: [
      {
        where: 'Front desk → Booking form',
        what: [
          'A “Custom” discount on a booking of several rooms or venues is now taken off once, not once for each. ₱6,200 off ₱50,000 is ₱43,800. The bill shows each room’s share of it.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06f',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'The buttons that appear when you pick dates are now centred on the dates you picked. Far to the right of the screen they used to be squashed, with the buttons on top of the dates. That is fixed.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06e',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'The buttons that appear when you pick a room and a date now always stay above your first pick, never below it.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06d',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'A booking made with No deposit says “Reserved · No Deposit” in blue, with no amount. An agency booking made with No deposit says the same.',
        ],
      },
      {
        where: 'Front desk → Booking form',
        what: [
          'In the Discount choices, “₱ off” is now called “Custom”. The box under it still asks for the amount to take off.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06c',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'A booking can be moved to another room or other dates. Open it and press “Change room or dates”. The guest, the agency and the payments stay on it.',
          'It shows the new amount before you save. If the guest has paid more than the new stay costs, it says so.',
          'It can be moved until the guest checks in.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06b',
    changes: [
      {
        where: 'Front desk → Booking form',
        what: [
          'Payment is one choice of three: Custom, Full pay or No deposit. None is chosen until you pick one. An agency booking has the same three. “Bill the agency” is gone.',
          'Custom fills in half of the stay. Change it if the guest agrees to something else, and write a note beside it. Full pay and No deposit have nothing to type.',
        ],
      },
      {
        where: 'Front desk → Calendar',
        what: [
          'A booking with no deposit says “No Deposit”.',
          'A booking made for an agency shows the agency’s name instead of the guest’s. Agency money is no longer blue.',
          'The arrow and the word “out” at the end of a booking are gone.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06',
    changes: [
      {
        where: 'Restaurant → Orders',
        what: [
          'A dish is on the order slip the moment you tap it. There is no waiting between dishes.',
          'An order starts with “New table”. A room is only asked for when the bill is sent.',
          '“Send to kitchen” puts the order on the kitchen’s screen. Nothing is printed for the kitchen.',
          'Each dish on the slip says where it is: new, cooking, ready or served. Tap “Served” when the food is on the table.',
          '“Send bill” sends the bill to the front desk, or adds it to a room’s bill.',
          'The line of tables at the top shows only the tables that still need something.',
          'The screen fits a tablet or a phone, held upright or sideways.',
        ],
      },
      {
        where: 'Restaurant → Kitchen',
        what: [
          'A new screen for the kitchen. Each order is a card with its table and its dishes.',
          'Tap a dish when it is cooked, or “Order ready” for the whole order. “Put back” brings back an order cleared by mistake.',
          'The waiting time turns gold after 10 minutes and red after 15.',
          'Tap “Turn sound on” once on the kitchen’s tablet, and it rings when an order arrives.',
        ],
      },
      {
        where: 'Front desk',
        what: [
          'On the calendar, a booking now starts in the middle of its check-in day and ends in the middle of its check-out day. A guest can check out on the day the next guest comes in: tap the empty morning of that day as the check-out day.',
          'Nobody pays in the restaurant now. “Diners to pay”, on the Today line, lists the diners with no room. A red dot means a bill was just sent over.',
          'A room guest’s food is paid from their booking, as before.',
          'The calendar is one flat sheet, so more rooms fit on the screen.',
          'A companion’s sex can be written on a booking, beside their name and nationality. It prints on the billing statement.',
          'In the booking form, “More details” opens under its own line, and the line beside “Confirm booking” says what is still missing.',
          'The deposit is typed. “Half”, “Full pay” and “No deposit” are shortcuts under the box. A booking with no deposit is a reservation, as before.',
          'Nationality is picked from a list as you type. Breakfast is a tick box.',
        ],
      },
      {
        where: 'Settings',
        what: [
          'Leaving Settings with something typed and not saved now asks first.',
          'The Airbnb and Booking.com links are saved with the same “Save changes” bar as everything else.',
          'The breakfast menu is a list of dishes only. Breakfast is still one charge for the stay, at the room’s breakfast price.',
        ],
      },
      {
        where: 'Receipts and statements',
        what: [
          'A payment receipt or a billing statement can be emailed to the guest with the “Email” button on the paper.',
          'The hotel’s Gmail is connected in Settings → Email.',
        ],
      },
    ],
  },
]

// Remembered on the device, not for a person: the staff have no logins of their own yet
// (card k74), and each of them works on their own tablet or the front desk's PC.
const SEEN = 'daweez_whats_new_seen'

/** The updates this device has not shown yet, newest first. */
export function unseenUpdates(): Update[] {
  let seen = ''
  try {
    seen = localStorage.getItem(SEEN) || ''
  } catch {
    // A browser that keeps nothing shows the latest update every time. That is all.
  }
  return UPDATES.filter(u => u.id > seen)
}

/** This device has shown everything there is. */
export function markUpdatesSeen(): void {
  try {
    if (UPDATES[0]) localStorage.setItem(SEEN, UPDATES[0].id)
  } catch {
    // See above.
  }
}

/** `2026-10-05b` → `October 5, 2026`. Built from the parts, never through UTC: the hotel is UTC+8. */
export function updateDay(id: string): string {
  const [y, m, d] = id.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
