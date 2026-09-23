Fixed — you found a real bug, and it was mine.

**What was wrong:** the grid *guessed* the day from the date. The rule was "if the anchor is the 1st of the current month, the desk means the current month, so open on today" — which cannot tell *1 September the desk asked for* apart from *1 September the arrows landed on*. So picking 09/01/2026 (a 1st, in the current month) snapped straight back to today, 23 September.

**Now:** each control says what it means and nothing is inferred —

- **date box** → exactly the day you pick, even the 1st of the current month (09/01/2026 now runs 1 Sep – 1 Oct).
- **‹ ›** → the 1st of the month they step to, **except** when that month is the current one, where they come home to today (so arriving back here never buries today off the right edge — the k154 rule).
- **Today** → today.

Refresh and try 09/01/2026 again; then step back out to October and return with ‹, which should still land on today.
