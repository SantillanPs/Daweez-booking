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
    id: '2026-10-20e',
    changes: [
      {
        where: 'Front desk → calendar and the booking window',
        what: [
          'Rooms booked together on one bill now show the same amount: every one of them shows what the whole bill still owes, not its own part.',
          'Tap the “rooms” tag beside “Left to pay” to see the bill’s rooms and jump to another one.',
          'Receive on any of them opens the bill, and the payment is shared out across all its rooms on one receipt.',
        ],
      },
    ],
  },
  {
    id: '2026-10-20d',
    changes: [
      {
        where: 'Front desk → the booking window → Receive',
        what: [
          'Receive now opens the billing statement. Tap “Write a payment” under the payments, pick Cash, GCash, Bank or Check, then Record. Change the day if the guest paid earlier.',
          'Tap “Add a charge” under the bill’s lines to put something on it, like Dinner ₱300. The × beside it takes it off again.',
          'On screen the statement leaves out the payment details, the policies and the signatures. They still print.',
        ],
      },
    ],
  },
  {
    id: '2026-10-20c',
    changes: [
      {
        where: 'Front desk → the booking window',
        what: [
          'Check in and Check out no longer go by the time you press them. Press them whenever you are back at the desk: the guest is counted as on time.',
          'If a guest really came early or left late, tap “Came early?” or “Left late?” under the button and tap the hours.',
        ],
      },
    ],
  },
  {
    id: '2026-10-20b',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'The Gazebo and the Garden are now booked by the hour, like a room’s short stay. Tap one day on the Gazebo for 6h or 4h w/ aircon, or on the Garden for 6h.',
          'The first time an hour has no price, the calendar asks you for it.',
          'The bookings on the calendar no longer show an amount, only Paid, Not paid, Part paid or Deposit paid. Point at one to see how much.',
        ],
      },
      {
        where: 'Settings → Other charges',
        what: [
          'Set the Gazebo’s and the Garden’s prices for their hours under Venues.',
        ],
      },
    ],
  },
  {
    id: '2026-10-20',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'The breakfast cup now shows on every room with breakfast, even if the guest was never checked in.',
          'Breakfast is asked until 11 AM. After that, a room nobody asked counts as no breakfast that day.',
          'Logging an old booking whose stay is already over no longer leaves a reservation. It is saved as checked in and out.',
        ],
      },
      {
        where: 'Front desk → Booking panel',
        what: [
          'You can take a charge off a booking: open Bill and press ✕ beside it (breakfast, extra foam, late checkout…). Press Undo if it was a mistake.',
        ],
      },
      {
        where: 'Front desk → New booking',
        what: [
          'You can add the guest’s institution (a school or an office). Press ⋯ beside Guest, then Add institution?',
          'Type to find a saved one. A new one is saved the first time you add it. It prints on the guest’s bill.',
        ],
      },
    ],
  },
  {
    id: '2026-10-18c',
    changes: [
      {
        where: 'Booking panel',
        what: [
          'While you take a payment, "Check in, pay later" steps aside. Close Receive to see it again.',
        ],
      },
    ],
  },
  {
    id: '2026-10-18b',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'A guest to check in or out now ripples on the calendar: green to check in, black to check out. Check-outs start at 12 PM and check-ins at 2 PM. A guest left from an earlier day ripples all day.',
          'Open the booking and its Check in or Check out button ripples too.',
          'The words on every booking sit in the middle.',
        ],
      },
      {
        where: 'Booking panel',
        what: [
          'A guest can check out before paying, just like check-in. The panel asks first and the amount stays on the bill.',
          'Checking a guest in or out gets a small celebration.',
        ],
      },
    ],
  },
  {
    id: '2026-10-18',
    changes: [
      {
        where: 'Payment receipt',
        what: [
          'The receipt fits the 58 mm printer: nothing cut off on the right, and the amount prints in full.',
          'Clearer letters and shorter: each fact is said once.',
        ],
      },
    ],
  },
  {
    id: '2026-10-17e',
    changes: [
      {
        where: 'Front desk → Log old booking',
        what: [
          'The paper is easier to read: bigger words, darker lines, and Guest, Stay and Payment parted.',
          'Pick one day on the calendar for a short stay, then Log old booking: just circle the hours.',
          'Circle the receptionist on duty from the names you already use.',
          'Each room or venue is its own card. Tap a day on it to change it, and pick the Vacation House kind along its bottom.',
          'Turn on breakfast with the switch at the bottom of each room\'s card. A room with no breakfast price asks for one there.',
        ],
      },
    ],
  },
  {
    id: '2026-10-17d',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'When you pick more than one room, the New booking bar moves to the last room you picked, so it stays where you are working.',
          'After you make a booking and press Done, you go straight back to the calendar. The booking no longer opens by itself.',
          'Tap the arrive or leave number under a date to light up those bookings. Tap anywhere else to let go.',
          'Reserved bookings are now soft gold, so they are easier to see.',
        ],
      },
      {
        where: 'Cash Flow → Earnings report',
        what: [
          'Money received for a booking that was later cancelled now stays in the report, on the day it was paid.',
        ],
      },
    ],
  },
  {
    id: '2026-10-17c',
    changes: [
      {
        where: 'Front desk → Log old booking',
        what: [
          'The form now looks like the paper you copy from, with the payment on the right.',
          'Tick Short stay to log a room taken for 3, 6, 12 or 22 hours.',
          'Tick Breakfast for each room that had it. It is charged for every night.',
          'After you log one, press Log another to copy the next paper. The receptionist stays filled in.',
        ],
      },
    ],
  },
  {
    id: '2026-10-17b',
    changes: [
      {
        where: 'Front desk → New booking',
        what: [
          'Breakfast is now charged for every night. Two nights with ₱300 breakfast is ₱600. The bill shows it as 2 × night.',
        ],
      },
    ],
  },
  {
    id: '2026-10-17',
    changes: [
      {
        where: 'Front desk → Booking',
        what: [
          'Press Receive: the amount is already filled in with what is owed. Type over it for any other amount.',
          'Pick Cash, GCash, Bank or Check, then press the gold Receive button. It shows the amount and the way to pay before you save.',
        ],
      },
    ],
  },
  {
    id: '2026-10-16d',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'A room with no price for 3, 6 or 12 hours shows a dashed chip. Tap it, type the price, and the short stay opens. The price is kept for that room.',
        ],
      },
      {
        where: 'Front desk → New booking',
        what: [
          'A room with no breakfast price shows “Set price”. Tap it and type the price: breakfast goes on, and the price is kept for that room.',
        ],
      },
    ],
  },
  {
    id: '2026-10-16c',
    changes: [
      {
        where: 'Front desk → Calendar → a booking',
        what: [
          'A booking opens out of its block on the calendar, and ✕ puts it back there.',
          'Receive is one button. Press it, then tap how they paid: Cash or Check is done at once, and GCash or a bank transfer asks for the reference number first.',
          'Check in, Check out, Undo and Cancel now ask right where you pressed them, with a Back button.',
          'The phone number and the guest’s other details are inside “Bill & details”.',
          'Take orders is no longer on a booking. Start every order from a table on the Restaurant screen.',
          'A short stay shows a ring that empties as the hours pass. When time is up, it says how many minutes past.',
          'The window grows and shrinks smoothly as the bill, Extend stay or Move opens, and a gold line marks the one that is open.',
        ],
      },
    ],
  },
  {
    id: '2026-10-16b',
    changes: [
      {
        where: 'Front desk → Calendar → making a booking',
        what: [
          'When you confirm, the button fills green and says “Booked”.',
          'The form then turns into a Booked card showing what was paid, with the receipt below it — print or email it there.',
          'Press Done and the card lands on the calendar as the new booking, which then opens.',
        ],
      },
    ],
  },
  {
    id: '2026-10-16',
    changes: [
      {
        where: 'Front desk → Calendar → making a booking',
        what: [
          'When you pick the dates, the gold stretches across night by night, and the bar shows how many nights.',
          'The booking form now opens from the dates you picked.',
          'The box the form is waiting for glows gold, so you can see what to fill in next.',
          'The form grows and shrinks smoothly as you open its parts.',
          'Nationality has a new list: Filipino is on top, the letters you type show in brown, and a green tick shows once one is picked.',
          'Receptionist is now the names used before, as buttons — tap yours. “Someone else” adds a new name.',
          'Guest and Payment get a green tick once they are filled in, and Confirm booking turns gold when it is ready.',
          'Breakfast shows what it adds beside the total.',
          'After you confirm, the button says “Booked”, then the receipt comes up. When you close the receipt, the new booking lands on the calendar and opens.',
        ],
      },
    ],
  },
  {
    id: '2026-10-15b',
    changes: [
      {
        where: 'Front desk → a booking → Receive',
        what: [
          'After you receive money, the green bar fills so you can see the money go in, and then the receipt opens.',
          'The receipt no longer jumps onto the screen before the “Paid” sign has finished.',
        ],
      },
      {
        where: 'Front desk → Calendar → point at a booking',
        what: [
          'The card that pops up is new: the guest’s name first, one block for each night (green for nights already slept, gold for tonight), and a bar showing how much is paid.',
          'It says when the guest is due to check in or out today.',
          'It opens faster, and at once when you move to the next booking.',
        ],
      },
      {
        where: 'Front desk → Calendar → the top line',
        what: [
          'Each bill the restaurant sends over now hangs on the top line as its own receipt, with the table and the amount. Tap it to take the money.',
          'After the diner pays, a “Paid” sign shows, then the receipt opens. When you close it, the bill tears off the line.',
        ],
      },
      {
        where: 'Front desk → a booking, and Restaurant → Send to kitchen',
        what: [
          'The “Paid”, “Checked in”, “Checked out” and “Sent to the kitchen” signs now cover the window properly instead of showing through.',
        ],
      },
      {
        where: 'Front desk → a booking',
        what: [
          'The booking window is new: what the guest still owes is the biggest thing on it, with the one button to press right under it.',
          'How the guest paid is now a box beside the Receive button.',
          'The bill — the room, order slips and payments — is folded under “Bill”. Tap it to see the lines and reprint a receipt.',
          'Extend, Move, Print bill, Take orders and Undo are small words along the bottom.',
          'A guest who has not paid in full can now be checked in: tap “Check in, pay later” under Receive. What they owe stays on the bill, and they pay it before they check out.',
        ],
      },
      {
        where: 'Front desk → the top bar and the Calendar',
        what: [
          'The gold mark under the tabs now slides to the tab you pick.',
          'After Sync works, the button turns green and says “Up to date”.',
          'Today turns gold when the calendar is showing other days, so you can jump back.',
          'A “+” shows on an empty day when you point at it.',
          'A line under each message runs out while it waits to close.',
        ],
      },
    ],
  },
  {
    id: '2026-10-15',
    changes: [
      {
        where: 'Front desk → a booking with an agency → Print billing statement',
        what: [
          'The agency’s bill has a new look, like the guest’s bill: the agency and the guest at the top, the dates beside them, one Total.',
          'There is now a line for the agency to sign when they receive the bill.',
        ],
      },
    ],
  },
  {
    id: '2026-10-14f',
    changes: [
      {
        where: 'Cash Flow → Earnings report',
        what: [
          'The Print daily report button is gone from here. Print it from Today’s money, as before.',
        ],
      },
    ],
  },
  {
    id: '2026-10-14e',
    changes: [
      {
        where: 'Cash Flow → Earnings report',
        what: [
          'When you open Pension, a room that earned money is now written in black so it is easier to read; a room with nothing stays grey.',
        ],
      },
    ],
  },
  {
    id: '2026-10-14d',
    changes: [
      {
        where: 'The top bar',
        what: [
          'Money is now called Cash Flow, and Stock is now called Inventory. Everything inside them is where it was.',
        ],
      },
      {
        where: 'Cash Flow → Earnings report',
        what: [
          'The report opens on Profit, Money in and Spent, then each place with what it earned and its share. Room rate and breakfast show under Pension; tap Pension to see each room.',
          'Table and Charts is now a switch beside Day / Week / Month. Charts shows how the hotel, each room, each venue and the restaurant are doing over 30 days, this year, all time or dates you pick. Tap a room in the list beside the chart to see only that room.',
          'Print daily report is a button under the report. “Count not yet confirmed” shows only when there is a booking not yet confirmed.',
        ],
      },
      {
        where: 'Front desk → Calendar',
        what: [
          'The breakfast cup beside a room shows only until 12 PM.',
          'When the kitchen has cooked a breakfast, the cup is now brown instead of green. Tap it once the breakfast is served.',
        ],
      },
    ],
  },
  {
    id: '2026-10-14c',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          '“All expenses” now shows a week, a month or a year: the total spent, a bar for each kind of expense, and the list. Use the arrows to go back to an earlier week, month or year.',
        ],
      },
    ],
  },
  {
    id: '2026-10-14b',
    changes: [
      {
        where: 'Front desk → History',
        what: [
          'Bookings is now History: everything that happened at the front desk, newest first, day by day. Payments received, new bookings, check-ins, check-outs and cancellations.',
          'Search a guest, room or receipt number, or tap Payments, Bookings, Check-ins & outs, Cancelled or Still to pay to see only those. Open takes you to the booking on the calendar.',
          'A payment logged by mistake can be removed from its row. It is taken off every room it paid for, and stays in the History crossed out so everyone can see it was removed.',
        ],
      },
    ],
  },
  {
    id: '2026-10-14',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          'You can now add the cash you already have in the hotel. Tap “Add cash on hand” under the day, type how much, and it is added to the Total cash on hand.',
          'It shows in the Summary as “Add: Cash added” on that day and carries over to the next days. It is not counted as sales. Tap “Take back” if it was a mistake.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13h',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          'Money taken off in the Summary is now written in brackets, like (₱1,600), instead of with a minus sign. The printed daily report says the same.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13g',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          'The bottom of the day now has the heading “Summary”.',
          '“Cash for today” is now “Total Sales”, and “Less: Expenses” is now “Total Expenses”. The printed daily report says the same.',
        ],
      },
      {
        where: 'Guest billing statement',
        what: [
          'At the top right, “Bill no.” and “Date Issued” now line up on the left, with the number and the date on the right.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13f',
    changes: [
      {
        where: 'Payment receipt',
        what: [
          'The receipt has a new look. The amount received is first, in a black bar.',
          'The balance is in plain words: Bill before, This payment, Still to pay. A stay that is fully paid shows “Paid in full” in a box.',
          'The guest signature line is gone from the receipt.',
          'Please print one receipt and check that the amount in the black bar is clear.',
        ],
      },
      {
        where: 'Guest billing statement',
        what: [
          'The bill no longer prints “None” when the guest has no contact number.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13e',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          'The bottom of the day now follows your own summary sheet: Cash for today, Add: Cash balance forwarded, Cash on hand, Less: Expenses, Less: Cash remitted, and Total cash on hand.',
          'Money handed to the owner shows as “Less: Cash remitted”, with “Take back” beside it.',
          'The printed daily report has the same lines.',
        ],
      },
      {
        where: 'Guest billing statement',
        what: [
          'The bill has a new look. The guest’s name and the room are in large type, the table has no boxes, and Amount due is in a black band at the bottom.',
          'Labels are grey and the information is black, so the two are easy to tell apart.',
          'Please print one bill and check that it fits the page.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13d',
    changes: [
      {
        where: 'Restaurant → Orders',
        what: [
          'The menu is now white, so it stands out from the page behind it.',
        ],
      },
      {
        where: 'Money → Today’s money',
        what: [
          '“This day” is now called “TOTAL CASH”. The printed daily report says the same.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13c',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          '“Left from the day before” is now called “Cash balance forwarded”, with the date of the day before beside it. The printed daily report says the same.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13b',
    changes: [
      {
        where: 'Money → Today’s money',
        what: [
          'The money now carries over from one day to the next. The bottom shows what was left from the day before, this day’s money, and “Money in the hotel”.',
          'When you hand money to the owner, tap “Hand over money” under the day. Type how much, who handed it over, and a note. It comes off “Money in the hotel” and is not counted as an expense.',
          'A hand-over shows as a gold line on the day it happened. “Take back” removes it if it was a mistake.',
          'Adding an expense is tidier: the four things you buy most are on the line, and the rest are under “More”.',
          'The printed daily report shows the same figures.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13',
    changes: [
      {
        where: 'Front desk → New booking',
        what: [
          'The Vacation House now has three choices when you book it: Vacation House ₱7,500, Vacation House & Ground ₱10,000, and Exclusive ₱15,000.',
        ],
      },
      {
        where: 'Everywhere',
        what: [
          'The system has a new icon on its browser tab.',
        ],
      },
    ],
  },
  {
    id: '2026-10-12',
    changes: [
      {
        where: 'Receipts and order slips',
        what: [
          'Printing a receipt is fixed. It was coming out blank on the receipt printer.',
        ],
      },
    ],
  },
  {
    id: '2026-10-09b',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'The calendar now shows what you just did. When you check a guest in, the green crosses their booking and the green bar grows beside the room. When you check them out, it drains to grey.',
          'When you receive money, the booking shows it straight away: the amount counts down, or changes to “Paid”.',
          'The numbers under each date drop as guests are checked in and out.',
          'The days slide sideways when you use the arrows, so you can see which way you moved.',
          'A booking now says “Reserved” before the guest checks in and “Occupied” while they are in the room. The guest’s name shows after they check out. Point at a booking, or open it, to see who it is. An agency’s booking still shows the agency.',
          'When the kitchen has cooked a room’s breakfast, a green cup shows beside that room. Tap it once the breakfast has been served.',
        ],
      },
      {
        where: 'Restaurant → Menu',
        what: [
          'New screen. You can change a dish’s name or price, add a new dish, and take one off the menu. Type in the box and it is saved when you leave it.',
          'Each dish also says how many times it has been ordered.',
        ],
      },
      {
        where: 'Front desk → a booking',
        what: [
          'After “Check in”, “Check out” or receiving money, the booking shows a mark for a moment to say it is done. A payment’s receipt opens right after it.',
          'A green bar under “Payment” shows how much of the bill has been paid.',
        ],
      },
    ],
  },
  {
    id: '2026-10-09',
    changes: [
      {
        where: 'Front desk → Calendar',
        what: [
          'A guest who has checked in is now green, not gold. The bar beside their room is green too.',
          'The date at the top has two pairs of arrows. The single arrows move the calendar one day. The double arrows move it one month.',
          'The small card that shows when you point at a booking is tidier: the name, then the dates as days with the number of nights, then the money.',
          '“Diners to pay” now shows only when the restaurant has sent a bill to the front desk. A table that is still eating is not on it.',
        ],
      },
      {
        where: 'Restaurant → Orders',
        what: [
          'The order slip is now on the right and the menu on the left.',
        ],
      },
    ],
  },
  {
    id: '2026-10-08b',
    changes: [
      {
        where: 'Restaurant → Orders',
        what: [
          'The line of tables at the top is gone. Tap the name at the top of the order slip (“Table 3”, or “Pick a table”) to see the tables.',
          'The tables are squares numbered 1 to 12. Tap an empty one to start that table. Tap one with an order to switch to it. “Other” is for a table with no number.',
          'A table is white while you take the order and gold while the kitchen has it. A green left edge means a dish is ready to serve.',
          'A green bell beside the table’s name shows how many dishes are cooked and waiting, on any table.',
          'You can tap a dish first. It asks which table, then puts the dish on it.',
          'The order slip has two parts: “To send” and “In the kitchen”. Each dish in the kitchen says cooking, ready or served.',
          'Tap a dish’s number to take one off. To add one, tap the dish on the menu.',
          'A dish that is ready turns green and has its own “Serve” button.',
          'After “Send to kitchen”, the slip tells you the order was sent.',
          '“Send bill” cannot be pressed until at least one dish has been served.',
          '“Send bill” now asks “Front desk” or “A room”. “A room” shows the rooms with a guest in them.',
          'On the menu, a dish on this order has a gold bar. The dish ordered the most has gold lines above and below it and says “Best seller”.',
          'Every button answers at once. You do not wait for “Serve”, “Send bill” or a new table before your next tap.',
        ],
      },
      {
        where: 'Front desk → Calendar',
        what: [
          'A booking with nothing paid says “No deposit” in blue again. The blue corner is gone.',
          'The “Breakfast” button at the top is gone. Tap the cup beside the room.',
          'The small card that shows when you point at a booking no longer hides under the top of the calendar.',
        ],
      },
    ],
  },
  {
    id: '2026-10-08',
    changes: [
      {
        where: 'Front desk → Breakfast today',
        what: [
          'The breakfast window now looks like the restaurant menu. Tap a dish to add one. Tap its number to take one off.',
          '“Save” is now “Serve”. When you press it, the order goes to the kitchen and the window tells you so.',
        ],
      },
      {
        where: 'Restaurant → Kitchen',
        what: [
          'A breakfast served at the front desk now shows on the kitchen screen as an order, with the room and the dishes. Press “Order ready” when it is done.',
        ],
      },
      {
        where: 'Front desk → Calendar',
        what: [
          'On a guest’s last morning the booking now shows their initials, not just “IN”.',
          'A room with a guest in it has a gold bar beside its number.',
          'The dotted outline on some bookings is gone.',
          'A booking that arrives today has a green left edge. One that leaves today has a dark right edge.',
          'A booking with nothing paid says “No deposit” in blue, on a half-day booking the initials are blue. It goes away once you record a cheque or any payment.',
          'An agency booking has a small building beside its name.',
          'A hopping cup beside a room means that room has breakfast today and has not been asked what they want. Tap the cup to ask. It goes away once you have.',
          'Under each date are two numbers: how many will leave (left, dark) and how many will arrive (right, green) that day.',
          'The “Today” line is gone, because the calendar now shows who arrives, who leaves and who is in. “Diners to pay” moved to the top right, and shows only when a diner has a bill open. For breakfast, tap the cup beside the room.',
          'Tap the “?” at the top right of the calendar to see what every sign means.',
        ],
      },
    ],
  },
  {
    id: '2026-10-06h',
    changes: [
      {
        where: 'Receipts and statements',
        what: [
          'The discount on a bill now says “Discount”, not “Staff discount”.',
          'A booking of several rooms prints one Discount row, with the total of all of them, instead of a row for each room.',
        ],
      },
    ],
  },
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
