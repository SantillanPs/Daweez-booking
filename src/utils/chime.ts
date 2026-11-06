let audio: AudioContext | null = null

/** A soft two-note chime, so a desk that is away from the screen hears that something needs them. */
export function chime() {
  try {
    audio = audio || new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const a = audio
    ;[659, 523].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain()
      o.frequency.value = f
      o.connect(g); g.connect(a.destination)
      const t = a.currentTime + i * 0.22
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      o.start(t); o.stop(t + 0.62)
    })
  } catch { /* no sound on this device: the screen still says it */ }
}
