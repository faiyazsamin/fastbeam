/** Auto-discovery: STUN probe → room keys → join; re-run on network changes. */
import { signal } from '@preact/signals'
import { REDISCOVER_HIDDEN_MS } from '../config'
import { nat } from '../state/network'
import { roomId } from './hash'
import { createPeerLink } from './peerLink'
import { introduceDiscovery } from './session'
import { trysteroSignaling, type RoomHandle } from './signaling'
import { stunProbe, type ProbeResult } from './stunProbe'

const rooms = new Map<string, RoomHandle>()

export const probing = signal(false)
export const lastProbe = signal<ProbeResult | null>(null)
/** True once at least one discovery room is joined. */
export const discovering = signal(false)

async function roomIdsFor(p: ProbeResult): Promise<string[]> {
  const ids: string[] = []
  if (p.ipv4) ids.push(await roomId('v4', p.ipv4))
  if (p.ipv6Prefix) ids.push(await roomId('v6', p.ipv6Prefix))
  return ids
}

function joinDiscoveryRoom(id: string): RoomHandle {
  return trysteroSignaling.join(id, {
    onPeer(_peerId, pc) {
      const link = createPeerLink(pc)
      introduceDiscovery(link).catch(() => link.close())
    },
    onPeerLeave() {
      /* the data channel close handles cleanup */
    },
  })
}

let running: Promise<void> | null = null

/** Probe and (re)join rooms. Leaves rooms whose key changed before joining the new ones. */
export function runDiscovery(): Promise<void> {
  if (running) return running
  running = (async () => {
    probing.value = true
    nat.value = 'checking'
    let probe: ProbeResult
    try {
      probe = await stunProbe()
    } catch {
      probe = { nat: 'unknown' }
    }
    lastProbe.value = probe
    nat.value = probe.nat
    probing.value = false

    const wanted = new Set(await roomIdsFor(probe))
    for (const [id, handle] of rooms) {
      if (!wanted.has(id)) {
        rooms.delete(id)
        void handle.leave()
      }
    }
    for (const id of wanted) {
      if (!rooms.has(id)) rooms.set(id, joinDiscoveryRoom(id))
    }
    discovering.value = rooms.size > 0
  })().finally(() => {
    running = null
  })
  return running
}

export function initDiscovery(): void {
  void runDiscovery()

  window.addEventListener('online', () => void runDiscovery())

  const conn = (navigator as Navigator & { connection?: EventTarget }).connection
  conn?.addEventListener('change', () => void runDiscovery())

  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else if (hiddenAt && Date.now() - hiddenAt > REDISCOVER_HIDDEN_MS) void runDiscovery()
  })
}
