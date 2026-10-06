/**
 * One outgoing and one incoming transfer at a time; anything else is answered with decline/busy.
 * Owns the wake lock and the beforeunload guard while a transfer runs.
 */
import { effect, signal } from '@preact/signals'
import type { ControlMessage, PeerLink } from '../net/peerLink'
import type { Peer } from '../state/peers'
import { toast } from '../state/toast'
import { isTransferMessage, type OfferMessage } from './protocol'
import { IncomingTransfer } from './receiver'
import { OutgoingTransfer } from './sender'

export const outgoing = signal<OutgoingTransfer | null>(null)
export const incoming = signal<IncomingTransfer | null>(null)

/** Fired for the UI when a new offer arrives (vibration, title prefix, dialog). */
export const incomingOffer = signal<IncomingTransfer | null>(null)

function busy(peer: Peer, link: PeerLink): boolean {
  const cur = incoming.value
  if (!cur) return false
  const st = cur.snap.value.state
  return st === 'offered' || st === 'receiving'
}

export function startSend(peer: Peer, link: PeerLink, input: { files: File[] } | { text: string }): OutgoingTransfer | null {
  const cur = outgoing.value
  if (cur && (cur.snap.value.state === 'offered' || cur.snap.value.state === 'sending')) {
    toast('Finish the current transfer first')
    return null
  }
  const t = new OutgoingTransfer(peer, link, input)
  outgoing.value = t
  void t.run()
  return t
}

export function clearOutgoing(): void {
  outgoing.value = null
}

export function clearIncoming(): void {
  const cur = incoming.value
  if (cur) {
    const st = cur.snap.value.state
    if (st === 'offered') cur.decline('declined')
    else if (st === 'receiving') cur.cancel()
  }
  incoming.value = null
  incomingOffer.value = null
}

export function handleControl(peer: Peer, link: PeerLink, msg: ControlMessage): void {
  if (!isTransferMessage(msg)) return
  if (msg.type === 'offer') {
    const offer = msg as OfferMessage
    const validFiles = (offer.files ?? []).every(
      (f) => typeof f.fileId === 'string' && typeof f.name === 'string' && typeof f.size === 'number' && f.size >= 0,
    )
    const validText = typeof offer.text === 'string' && offer.text.length <= 64 * 1024
    if ((!offer.files?.length && !validText) || !validFiles || typeof offer.totalSize !== 'number') return
    if (busy(peer, link)) {
      link.sendControl({ type: 'decline', transferId: offer.transferId, reason: 'busy' })
      return
    }
    const t = new IncomingTransfer(peer, link, offer, () => {
      if (incomingOffer.value === t) incomingOffer.value = null
    })
    incoming.value = t
    incomingOffer.value = t
    return
  }
  const out = outgoing.value
  if (out && out.id === msg.transferId) {
    out.handle(msg)
    return
  }
  const inc = incoming.value
  if (inc && inc.id === msg.transferId) inc.handle(msg)
}

export function handleChunk(_peer: Peer, _link: PeerLink, frame: ArrayBuffer): void {
  incoming.value?.handleChunk(frame)
}

export function onPeerGone(peer: Peer, _link: PeerLink): void {
  const out = outgoing.value
  if (out && out.peer.deviceId === peer.deviceId) out.fail(`${peer.name} disconnected`)
  const inc = incoming.value
  if (inc && inc.peer.deviceId === peer.deviceId) inc.fail(`${peer.name} disconnected`)
}

// ---- Wake lock + unload guard ------------------------------------------------------------------

let wakeLock: WakeLockSentinel | null = null
let wantWake = false

async function acquireWake(): Promise<void> {
  if (!wantWake || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch {
    wakeLock = null
  }
}

function releaseWake(): void {
  wantWake = false
  void wakeLock?.release()
  wakeLock = null
}

export function transferActive(): boolean {
  const o = outgoing.value?.snap.value.state
  const i = incoming.value?.snap.value.state
  return o === 'sending' || i === 'receiving'
}

export function initTransferGuards(): void {
  effect(() => {
    const active = transferActive()
    if (active) {
      wantWake = true
      void acquireWake()
    } else releaseWake()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void acquireWake()
  })
  window.addEventListener('beforeunload', (e) => {
    if (transferActive()) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}
