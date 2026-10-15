/** The green tick a part of the booking form wears once it is filled in. It draws itself
 *  when it first appears (`.bk-seal` in `index.css`) — the booking moments mock, 2026-10-16. */
export function Seal() {
  return (
    <svg className="bk-seal w-[18px] h-[18px] shrink-0" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="9" className="fill-emerald-600" />
      <path d="M5 9.4l2.6 2.5L13 6.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
