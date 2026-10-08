/**
 * A gold dot that flies from a dish on the menu to its line on the order slip (Sebastian,
 * 2026-10-08: *"make it move towards the position of the item selected"*). It is what
 * says the tap landed, and where.
 *
 * `to` is tried in order; the first one that is on screen is where it lands — the slip is
 * drawn twice (beside the menu, and in the sheet on a phone) and only one is showing.
 */
export function flyDot(from: DOMRect, to: string[]) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const target = to.flatMap(q => Array.from(document.querySelectorAll(q))).find(el => el.getClientRects().length > 0)
  if (!target) return
  const end = target.getBoundingClientRect()

  const dot = document.createElement('div')
  dot.style.cssText = 'position:fixed;z-index:80;width:16px;height:16px;border-radius:9999px;background:#D0AB60;pointer-events:none;' +
    'transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s;' +
    'left:' + (from.left + from.width / 2 - 8) + 'px;top:' + (from.top + from.height / 2 - 8) + 'px'
  document.body.append(dot)
  requestAnimationFrame(() => {
    dot.style.transform = 'translate(' + (end.left + 26 - from.left - from.width / 2) + 'px,' +
      (end.top + end.height / 2 - from.top - from.height / 2) + 'px) scale(.5)'
    dot.style.opacity = '.2'
  })
  window.setTimeout(() => dot.remove(), 520)
}
