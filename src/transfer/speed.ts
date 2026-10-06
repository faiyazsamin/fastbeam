/** Bytes-per-second over a sliding 3 s window. */
export class SpeedMeter {
  private samples: { t: number; bytes: number }[] = []
  private total = 0

  constructor(private readonly windowMs = 3000) {}

  reset(): void {
    this.samples = []
    this.total = 0
  }

  add(bytes: number, now = Date.now()): void {
    this.total += bytes
    this.samples.push({ t: now, bytes: this.total })
    const cutoff = now - this.windowMs
    while (this.samples.length > 2 && (this.samples[0]?.t ?? 0) < cutoff) this.samples.shift()
  }

  speed(now = Date.now()): number {
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    if (!first || !last || last === first) return 0
    const dt = Math.max(now - first.t, last.t - first.t, 1)
    return ((last.bytes - first.bytes) * 1000) / dt
  }
}
