/**
 * The booking form's boxes, labels and parts, written once.
 *
 * **Sizes (the design review, 2026-10-04).** The form had three box heights (48px guest
 * boxes, 32px Receptionist, 25px money buttons) and label text down to 10px, with the
 * sizes upside down: the boxes staff rarely fill were the biggest things on the page and
 * the choices that decide the money were the smallest. Every box and every chooser is now
 * one height — 44px, a fingertip, because the desk uses a tablet as well as the PC — and
 * nothing a person has to read is under 13px.
 *
 * **Flat (the same day).** *"I don't like the boxes design. I prefer a more 2d, clean,
 * minimalistic, simple, yet professional look."* So nothing here draws a card. The form is
 * one white surface; the only outlines are the things a person types in or picks from.
 *
 * **The system's own colours** (the owner, the same day: *"make the color theme same as
 * the system's color palette"*). The form was drawn in daisyUI's colour names — a cream
 * edge on every box where the rest of the app has a soft grey one. It now uses the names
 * every other screen uses (`bg-card`, `border-soft`, `text-main`, `text-muted`), a gold
 * edge on the box being typed in, and gold for what is chosen.
 *
 * **Three kinds of row, and no more** (the staff's feedback, the same day: the flat form was
 * *"hard to read and understand"*; then a second pass on its look):
 *   - a box to type in, with its label **above** it (`Field`);
 *   - an optional extra — more details, companions, breakfast, add-ons, discount — as one
 *     line in a ruled list, its name at one end and what it holds at the other, the whole
 *     line pressable (`OPTION_LIST` / `OPTION_ROW`);
 *   - the payment, in a column of its own beside the guest on a wide screen.
 */
const BOX = 'h-11 rounded-md border bg-card px-3 text-[15px] font-medium text-main placeholder:font-normal placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-400/30'
export const FIELD = BOX + ' w-full border-soft'
/** The same box when it shares a row and must take what is left of it. */
export const FIELD_IN_ROW = BOX + ' flex-1 min-w-0 border-soft'
export const FIELD_ERROR = BOX + ' w-full border-danger-400'
export const SELECT = BOX + ' w-full border-soft cursor-pointer'

/** The words above a box or a row of choices. */
export const LABEL = 'block text-[13px] font-medium text-muted'

/** One of the form's parts — Guest, Stay, Payment. */
export const GROUP = 'space-y-3'
/**
 * A part's name, in the display face. It is told apart from the labels under it by its
 * face and weight, not by a rule drawn across the form.
 */
export const GROUP_TITLE = 'font-display text-[17px] font-bold tracking-tight text-main'

/** The ruled list of optional extras. */
export const OPTION_LIST = 'border-y border-soft divide-y divide-soft'
/** One extra: its name at the left end, what it holds at the right. */
export const OPTION_ROW = 'w-full min-h-12 flex items-center justify-between gap-4 text-left'
/** An extra's name. */
export const OPTION_NAME = 'text-[15px] font-medium text-main shrink-0'
/** What an extra holds, or the word that opens it. */
export const OPTION_VALUE = 'inline-flex items-center gap-1.5 min-w-0 text-[14px] font-semibold text-brand-text'

/** The correction block's own heading. */
export const SECTION = 'space-y-3'
export const SECTION_TITLE = GROUP_TITLE
/** The quiet text actions inside an opened extra. */
export const TEXT_ACTION = 'inline-flex items-center gap-1 h-11 text-[14px] font-semibold text-brand-text hover:underline cursor-pointer'

/** A small square button: one more, one fewer, remove. */
export const ICON_BUTTON = 'w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:bg-softbg hover:text-main transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer'

/** What opens under a row: it settles in rather than snapping. */
export const REVEAL = 'animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none'
