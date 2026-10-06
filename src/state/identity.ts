import { detectDevice } from './device'
import { isNonEmptyString, persisted } from './storage'

function uuid(): string {
  const c: Crypto = crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Stable per-browser device identity. Generated once, kept in localStorage. */
export const deviceId = persisted('deviceId', uuid, isNonEmptyString)

/** What this device looks like to others (type, platform, browser). */
export const device = detectDevice()
