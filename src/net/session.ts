/**
 * Turns an open PeerLink into a Peer: hello exchange, ping/timeout, routing of control and binary
 * frames to the transfer manager, and cleanup when the link closes.
 */
import { effect } from '@preact/signals'
import { PEER_TIMEOUT_MS, PING_INTERVAL_MS, PROTOCOL } from '../config'
import type { DeviceType } from '../state/device'
import { device, deviceId } from '../state/identity'
import { getPeer, peers, removePeer, setPeer, updatePeer, type Peer } from '../state/peers'
import { deviceName, discoverable } from '../state/settings'
import { toast } from '../state/toast'
import { handleChunk, handleControl, onPeerGone } from '../transfer/manager'
import { verificationCode } from '../transfer/protocol'
import type { ControlMessage, PeerLink } from './peerLink'

export interface HelloMessage extends ControlMessage {
  type: 'hello'
  deviceId: string
  name: string
  deviceType: DeviceType
  platform: string
  browser: string
  protocol: number
  discoverable: boolean
}

export function helloMessage(): HelloMessage {
  return {
    type: 'hello',
    deviceId: deviceId.value,
    name: deviceName.value,
    deviceType: device.deviceType,
    platform: device.platform,
    browser: device.browser,
    protocol: PROTOCOL,
    discoverable: discoverable.value,
  }
}

export function isHello(msg: ControlMessage): msg is HelloMessage {
  return (
    msg.type === 'hello' &&
    typeof msg.deviceId === 'string' &&
    typeof msg.name === 'string' &&
    typeof msg.protocol === 'number'
  )
}

/** Resolve with the first control message that `accept` returns true for, or reject on timeout/close. */
export function waitForControl(
  link: PeerLink,
  timeoutMs: number,
  accept: (msg: ControlMessage) => boolean,
): Promise<ControlMessage> {
  return new Promise((resolve, reject) => {
    const prevControl = link.onControl
    const prevClose = link.onClose
    const timer = window.setTimeout(() => finish(new Error('timeout')), timeoutMs)
    const finish = (err: Error | null, msg?: ControlMessage) => {
      window.clearTimeout(timer)
      link.onControl = prevControl
      link.onClose = prevClose
      if (err) reject(err)
      else if (msg) resolve(msg)
    }
    link.onControl = (msg) => {
      if (accept(msg)) finish(null, msg)
      else prevControl?.(msg)
    }
    link.onClose = () => {
      prevClose?.()
      finish(new Error('closed'))
    }
  })
}

interface AttachFlags {
  paired: boolean
  passwordVerified: boolean
}

const linkTimers = new WeakMap<PeerLink, { ping: number; watchdog: number }>()

function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || 'Device'
}

/** Register a peer once hellos have been exchanged on `link`. Safe to call for a second link to the same device. */
export async function attachPeer(link: PeerLink, hello: HelloMessage, flags: AttachFlags): Promise<Peer> {
  if (hello.deviceId === deviceId.value) {
    // Another tab of ours on the same network: ignore it.
    link.close()
    throw new Error('self')
  }
  const fps = link.fingerprints()
  const code = fps ? await verificationCode(fps.local, fps.remote) : '------'
  const existing = getPeer(hello.deviceId)
  const peer: Peer = existing
    ? {
        ...existing,
        name: cleanName(hello.name),
        deviceType: hello.deviceType,
        platform: hello.platform,
        browser: hello.browser,
        protocol: hello.protocol,
        discoverable: hello.discoverable,
        paired: existing.paired || flags.paired,
        passwordVerified: existing.passwordVerified || flags.passwordVerified,
        links: [...existing.links, link],
        lastSeen: Date.now(),
      }
    : {
        deviceId: hello.deviceId,
        name: cleanName(hello.name),
        deviceType: hello.deviceType,
        platform: hello.platform,
        browser: hello.browser,
        protocol: hello.protocol,
        discoverable: hello.discoverable,
        paired: flags.paired,
        passwordVerified: flags.passwordVerified,
        verificationCode: code,
        flash: false,
        links: [link],
        lastSeen: Date.now(),
      }
  setPeer(peer)
  if (!existing) toast(`${peer.name} joined`)

  const id = peer.deviceId
  const touch = () => {
    updatePeer(id, { lastSeen: Date.now() })
    armWatchdog()
  }
  const armWatchdog = () => {
    const t = linkTimers.get(link)
    if (t) window.clearTimeout(t.watchdog)
    const watchdog = window.setTimeout(() => link.close(), PEER_TIMEOUT_MS)
    linkTimers.set(link, { ping: t?.ping ?? 0, watchdog })
  }
  const ping = window.setInterval(() => link.sendControl({ type: 'ping' }), PING_INTERVAL_MS)
  linkTimers.set(link, { ping, watchdog: 0 })
  armWatchdog()

  link.onControl = (msg) => {
    touch()
    if (msg.type === 'ping') return
    if (isHello(msg)) {
      updatePeer(id, { name: cleanName(msg.name), discoverable: msg.discoverable, protocol: msg.protocol })
      return
    }
    const p = getPeer(id)
    if (p) handleControl(p, link, msg)
  }
  link.onChunk = (frame) => {
    const p = getPeer(id)
    if (p) handleChunk(p, link, frame)
  }
  link.onClose = () => {
    const t = linkTimers.get(link)
    if (t) {
      window.clearInterval(t.ping)
      window.clearTimeout(t.watchdog)
    }
    const p = getPeer(id)
    if (!p) return
    const links = p.links.filter((l) => l !== link)
    if (links.length > 0) {
      updatePeer(id, { links })
      return
    }
    onPeerGone(p, link)
    removePeer(id)
    toast(`${p.name} left`)
  }
  return peer
}

/** Same-network introduction: both sides say hello straight away. */
export async function introduceDiscovery(link: PeerLink): Promise<void> {
  await link.ready
  const theirs = waitForControl(link, PEER_TIMEOUT_MS, isHello)
  link.sendControl(helloMessage())
  const hello = (await theirs) as HelloMessage
  await attachPeer(link, hello, { paired: false, passwordVerified: false })
}

/** Keep names and visibility live on every connected peer. */
export function initSessionBroadcast(): void {
  let first = true
  effect(() => {
    const msg = helloMessage()
    if (first) {
      first = false
      return
    }
    for (const p of peers.peek().values()) for (const l of p.links) l.sendControl(msg)
  })
}
