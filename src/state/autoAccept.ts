import { signal } from '@preact/signals'

/**
 * Session-only auto-accept, per device. Nothing is persisted: closing the tab forgets it, and a device
 * only becomes eligible after one transfer from it was accepted by hand.
 */
export const autoAccept = signal<ReadonlySet<string>>(new Set())
export const acceptedOnce = signal<ReadonlySet<string>>(new Set())

export function markAccepted(deviceId: string): void {
  if (acceptedOnce.value.has(deviceId)) return
  acceptedOnce.value = new Set([...acceptedOnce.value, deviceId])
}

export function canOfferAutoAccept(deviceId: string): boolean {
  return acceptedOnce.value.has(deviceId)
}

export function isAutoAccept(deviceId: string): boolean {
  return autoAccept.value.has(deviceId)
}

export function setAutoAccept(deviceId: string, on: boolean): void {
  const next = new Set(autoAccept.value)
  if (on) next.add(deviceId)
  else next.delete(deviceId)
  autoAccept.value = next
}
