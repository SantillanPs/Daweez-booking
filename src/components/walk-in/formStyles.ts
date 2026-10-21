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
export const BOX = 'h-11 rounded-md border bg-card px-3 text-[15px] font-medium text-main placeholder:font-normal placeholder:text-muted outline-none focus-visible:outline-none transition-[border-color,box-shadow] duration-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-400/30'
export const FIELD = BOX + ' w-full border-soft'
/** The same box when it shares a row and must take what is left of it. */
export const FIELD_IN_ROW = BOX + ' flex-1 min-w-0 border-soft'
export const FIELD_ERROR = BOX + ' w-full border-danger-400'
export const SELECT = BOX + ' w-full border-soft cursor-pointer'

/**
 * **The booking form's boxes are softly filled** (the Guest and Stay mock, Sebastian,
 * 2026-10-21: "I like it. apply it"): a cream fill and no outline, turning white with a gold
 * edge while typed in. The outlined `BOX` above stays for every other screen.
 */
export const FILL_BOX = 'h-11 rounded-[10px] border-[1.5px] border-transparent bg-softbg px-3 text-[15px] font-semibold text-main placeholder:font-medium placeholder:text-muted outline-none focus-visible:outline-none transition-[background-color,border-color,box-shadow] duration-200 focus:bg-card focus:border-gold-500 focus:ring-[3px] focus:ring-gold-400/20'
export const FILL = FILL_BOX + ' w-full'
export const FILL_IN_ROW = FILL_BOX + ' flex-1 min-w-0'
export const FILL_ERROR = FILL_BOX + ' w-full !bg-card !border-danger-400'
export const FILL_SELECT = FILL_BOX + ' w-full cursor-pointer'

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
/*
 * **One shape for every extra, quiet until it holds something** (the Guest and Stay mock,
 * Sebastian, 2026-10-21): a small icon tile, the name, what it holds in bold, and a gold +
 * that turns to × while the line is open. An empty extra is grey; once it holds something
 * its name darkens and its tile turns gold, so what was added is what the eye finds.
 */
/** One extra: the tile, the name, what it holds, the +. */
export const OPTION_ROW = 'group/opt w-full min-h-[52px] flex items-center gap-3 text-left'
/** The icon tile at the start of the line. */
export const optionIcon = (on: boolean) =>
  'w-[30px] h-[30px] shrink-0 rounded-lg grid place-items-center transition-colors duration-200 [&>svg]:w-4 [&>svg]:h-4 ' +
  (on ? 'bg-gold-400 text-ink-900' : 'bg-softbg text-gold-800')
/** An extra's name. */
export const optionName = (on: boolean) =>
  'flex-1 min-w-0 text-[15px] transition-colors duration-200 ' + (on ? 'font-semibold text-main' : 'font-medium text-ink-600')
/** What an extra holds, at the end of its line. */
export const OPTION_VALUE = 'bp-up min-w-0 truncate text-[14px] font-bold text-main tabular-nums'
/** The gold + that opens the line, turned to × while it is open. */
export const optionPlus = (open: boolean) =>
  'w-8 h-8 shrink-0 rounded-[9px] grid place-items-center text-gold-800 transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/opt:bg-gold-100 [&>svg]:w-4 [&>svg]:h-4 ' +
  (open ? 'rotate-45 bg-gold-100' : '')
/** What opens under a line, set in to the name's edge on a wide screen. */
export const OPTION_BODY = 'sm:pl-[42px]'

/** The correction block's own heading. */
export const SECTION = 'space-y-3'
export const SECTION_TITLE = GROUP_TITLE
/** The quiet text actions inside an opened extra. */
export const TEXT_ACTION = 'inline-flex items-center gap-1 h-11 text-[14px] font-semibold text-brand-text hover:underline cursor-pointer'

/** A small square button: one more, one fewer, remove. */
export const ICON_BUTTON = 'w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:bg-softbg hover:text-main transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer'

/** What opens under a row: it settles in rather than snapping. */
export const REVEAL = 'animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none'

/** A window's main button and its quiet Cancel — they were daisyUI's `btn`s until it was removed (2026-10-18). */
export const PRIMARY_BUTTON = 'h-11 px-5 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer disabled:opacity-60'
export const QUIET_BUTTON = 'h-11 px-4 rounded-lg text-sm font-semibold text-main hover:bg-page transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer'
