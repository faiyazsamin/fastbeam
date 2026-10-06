import { computed, signal } from '@preact/signals'
import type { PeerLink } from '../net/peerLink'
import type { DeviceType } from './device'

export interface Peer {
  deviceId: string
  name: string
  deviceType: DeviceType
  platform: string
  browser: string
  protocol: number
  discoverable: boolean
  /** Reached through a code, link or QR rather than the local network. */
  paired: boolean
  passwordVerified: boolean
  /** Six digits both sides can compare (base spec, "Verification code"). */
  verificationCode: string
  /** Set once after pairing so the tile can flash. */
  flash: boolean
  /** Live links to this device (one per room it shares with us); the first is the primary. */
  links: PeerLink[]
  lastSeen: number
}

export const peers = signal<ReadonlyMap<string, Peer>>(new Map())

/** Peers shown on Home: discoverable ones plus anything we paired with explicitly. */
export const visiblePeers = computed(() =>
  [...peers.value.values()]
    .filter((p) => p.discoverable || p.paired)
    .sort((a, b) => a.name.localeCompare(b.name)),
)

export function getPeer(deviceId: string): Peer | undefined {
  return peers.value.get(deviceId)
}

export function primaryLink(peer: Peer): PeerLink | undefined {
  return peer.links.find((l) => l.open) ?? peer.links[0]
}

export function setPeer(peer: Peer): void {
  const next = new Map(peers.value)
  next.set(peer.deviceId, peer)
  peers.value = next
}

export function updatePeer(deviceId: string, patch: Partial<Peer>): Peer | undefined {
  const cur = peers.value.get(deviceId)
  if (!cur) return undefined
  const next = { ...cur, ...patch }
  setPeer(next)
  return next
}

export function removePeer(deviceId: string): void {
  if (!peers.value.has(deviceId)) return
  const next = new Map(peers.value)
  next.delete(deviceId)
  peers.value = next
}

export function flashPeer(deviceId: string): void {
  updatePeer(deviceId, { flash: true })
  window.setTimeout(() => updatePeer(deviceId, { flash: false }), 1600)
}

export function peerSubtitle(p: Peer): string {
  const parts = [p.platform, p.browser.split(' ')[0] ?? p.browser]
  return parts.filter(Boolean).join(' · ')
}
