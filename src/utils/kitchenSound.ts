// The sound the kitchen hears when an order arrives.
//
// On paper the order was put in the cook's hand; on a screen it has to make itself
// noticed, because the cook is looking at the stove. The chime is made by the browser
// itself — two short notes, no sound file to load.
//
// It is switched on per DEVICE and remembered there: the kitchen's tablet chimes, the
// front desk's PC does not. A browser only plays sound once the screen has been touched,
// which is why it is turned on with a tap.

const KEY = 'daweez_kitchen_sound'

let audio: AudioContext | null = null

/** True when this device has been told to chime. */
export function kitchenSoundIsOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

/** Remembers the choice on this device. Turning it on plays the chime once, so it is heard working. */
export function setKitchenSound(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // A browser that refuses to remember still chimes until the page is closed.
  }
  if (on) playKitchenChime()
}

/**
 * Wakes the sound up after the page was reloaded: the choice was remembered, but the
 * browser stays silent until the screen is touched again. Called on the first touch.
 */
export function wakeKitchenSound(): void {
  try {
    audio = audio || new AudioContext()
    void audio.resume()
  } catch {
    // No sound on this device; the order still shows on the screen.
  }
}

/** Two short notes. Says nothing and breaks nothing when the browser will not play it. */
export function playKitchenChime(): void {
  try {
    audio = audio || new AudioContext()
    void audio.resume()
    const start = audio.currentTime
    for (const [pitch, at] of [[880, 0], [1175, 0.18]] as const) {
      const note = audio.createOscillator()
      const volume = audio.createGain()
      note.type = 'sine'
      note.frequency.value = pitch
      volume.gain.setValueAtTime(0.0001, start + at)
      volume.gain.exponentialRampToValueAtTime(0.4, start + at + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.32)
      note.connect(volume).connect(audio.destination)
      note.start(start + at)
      note.stop(start + at + 0.34)
    }
  } catch {
    // No sound on this device; the order still shows on the screen.
  }
}
