/**
 * A confetti cannon, for the moment a guest is checked in or out (the check-in loop mocks,
 * Sebastian, 2026-10-18: "cannons + fly home"). It fires `count` pieces from a point on the
 * screen, up at `angle` degrees (90 is straight up), and gravity brings them down. Nothing
 * fires when the device asks for less motion.
 */
const COLOURS = ['#059669', '#D0AB60', '#1C1C1C', '#34D399', '#E3C68C', '#FFFFFF']

export function confettiCannon(x: number, y: number, angle: number, count = 36) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden'
  document.body.appendChild(layer)
  const T = 1600
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span')
    const long = i % 4 === 1
    bit.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${long ? 4 : 8}px;height:${long ? 12 : 8}px;` +
      `border-radius:${i % 3 === 0 ? '50%' : '2px'};background:${COLOURS[i % COLOURS.length]}`
    const a = (angle + (Math.random() - 0.5) * 50) * Math.PI / 180
    const v = 140 + Math.random() * 150
    const frames: Keyframe[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8 * (T / 1000)
      frames.push({
        transform: `translate(${Math.cos(a) * v * t}px, ${-Math.sin(a) * v * t + 380 * t * t}px) rotate(${t * 720 * (i % 2 ? 1 : -1)}deg)`,
        opacity: k > 6 ? 1 - (k - 6) / 2 : 1,
      })
    }
    bit.animate(frames, { duration: T, easing: 'linear', fill: 'forwards' })
    layer.appendChild(bit)
  }
  window.setTimeout(() => layer.remove(), T + 50)
}
