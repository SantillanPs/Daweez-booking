Built — Option C, word for word:

- **One short list**: `Guest pays by` above a single control showing the chosen method, opening Cash / GCash / Bank transfer.
- **Reference on its own line** under it, short label `Ref no. *` and a full-width box.
- **`Guest has paid`** is the button that opens the step; **`Record ₱625 received`** is the full-width confirm, with a quiet `Cancel` under it. No "print receipt" on the label.
- The receipt still prints straight after the payment is recorded — unchanged.

One thing I had to add so the receipt can never name the wrong method: **nothing is preselected**. A booking with no method shows `Choose…`, and pressing record without choosing says *Choose how the guest paid.* That is the same bug you hit before (a GCash payment printing as Cash) — the old code quietly defaulted to Cash. Same rule in the Record-a-payment form in Payment receipts.

Refresh the calendar, open a booking, press `Guest has paid` on a narrow window — say if anything still looks off.
