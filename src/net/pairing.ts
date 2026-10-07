/**
 * Manual pairing: host a code (screen 7) or join one (screens 8 → 10 → 9 → Home, or 11).
 * The room is derived from the code alone; the optional password is checked on the data channel
 * before any hello (build-notes §4).
 */
import { signal } from '@preact/signals'
import {
  CANONICAL_ORIGIN,
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_TTL_MS,
  PAIR_RETRY_MS,
  PAIR_TIMEOUT_MS,
  PASSWORD_MIN,
  PEER_TIMEOUT_MS,
} from '../config'
import { logger } from '../state/log'
import { nat } from '../state/network'
import type { NatKind } from './stunProbe'

const L = logger('pair')
import { flashPeer, type Peer } from '../state/peers'
import { toast } from '../state/toast'
import { b64url, fromB64url, roomId } from './hash'
import {
  AuthLimiter,
  authMac,
  deriveAuthKeyInWorker,
  randomNonce,
  verifyAuthMac,
} from './pairAuth'
import { createPeerLink, type ControlMessage, type PeerLink } from './peerLink'
import { attachPeer, helloMessage, isHello, sendUntil, waitForControl, type HelloMessage } from './session'
import { trysteroSignaling, type RoomHandle } from './signaling'
import { suggestPassword } from './wordlist'

// ---- Codes -------------------------------------------------------------------------------------

export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return s
}

/** Upper-case, strip spaces/dashes/dots. Does not validate. */
export function normalizeCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-·.]/g, '')
}

export function isCodeChar(ch: string): boolean {
  return ch.length === 1 && CODE_ALPHABET.includes(ch.toUpperCase())
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every(isCodeChar)
}

/** Extract a code from a pasted code, a fastbeam link, or a link to this origin. */
export function codeFromText(text: string): string | null {
  const t = text.trim()
  const direct = normalizeCodeInput(t)
  if (isValidCode(direct)) return direct
  try {
    const u = new URL(t)
    const okHost = u.origin === CANONICAL_ORIGIN || u.origin === location.origin
    if (!okHost) return null
    return codeFromHash(u.hash)
  } catch {
    return null
  }
}

export function codeFromHash(hash: string): string | null {
  const h = hash.replace(/^#/, '')
  const m = /^(?:pair=)?([A-Za-z0-9]{6})$/.exec(h)
  if (!m?.[1]) return null
  const code = normalizeCodeInput(m[1])
  return isValidCode(code) ? code : null
}

export function pairLink(code: string): string {
  return `${CANONICAL_ORIGIN}/#${code}`
}

export function formatCode(code: string): string {
  return `${code.slice(0, 3)}·${code.slice(3)}`
}

// ---- Host --------------------------------------------------------------------------------------

export interface HostState {
  code: string
  expiresAt: number
  locked: boolean
  password: string
  /** Set while the KDF runs for a new password. */
  deriving: boolean
}

export const host = signal<HostState | null>(null)

interface HostRoom {
  code: string
  handle: RoomHandle
  limiter: AuthLimiter
  links: Set<PeerLink>
  expiry: number
  retired: boolean
}

let hostRoom: HostRoom | null = null
const retiredRooms = new Set<HostRoom>()
let hostKey: Promise<CryptoKey> | null = null
let hostKeyFor = ''
let hostPasswordTimer = 0

function retire(room: HostRoom): void {
  room.retired = true
  window.clearTimeout(room.expiry)
  if (room.links.size === 0) void room.handle.leave()
  else retiredRooms.add(room)
}

function dropFromRoom(room: HostRoom, link: PeerLink): void {
  room.links.delete(link)
  if (room.retired && room.links.size === 0) {
    retiredRooms.delete(room)
    void room.handle.leave()
  }
}

async function ensureHostKey(password: string, code: string): Promise<CryptoKey> {
  const tag = `${code}:${password}`
  if (!hostKey || hostKeyFor !== tag) {
    hostKeyFor = tag
    const h = host.value
    if (h) host.value = { ...h, deriving: true }
    hostKey = deriveAuthKeyInWorker(password, code).finally(() => {
      const cur = host.value
      if (cur && hostKeyFor === tag) host.value = { ...cur, deriving: false }
    })
  }
  return hostKey
}

async function hostIntro(room: HostRoom, link: PeerLink): Promise<void> {
  await link.ready
  room.links.add(link)
  const prevClose = link.onClose
  link.onClose = () => {
    prevClose?.()
    dropFromRoom(room, link)
  }

  const h = host.value
  const locked = !!h && h.code === room.code && h.locked && h.password.length >= PASSWORD_MIN
  let passwordVerified = false
  L.info(`someone joined code ${room.code}`, { locked })

  if (locked && h) {
    const key = await ensureHostKey(h.password, room.code)
    const fps = link.fingerprints()
    if (!fps) throw new Error('no fingerprints')
    const nH = randomNonce()
    const firstProof = waitForControl(link, CODE_TTL_MS, (m) => m.type === 'auth-proof')
    sendUntil(link, { type: 'auth-required', nH: b64url(nH), name: helloMessage().name }, firstProof)

    for (let attempt = 0; ; attempt++) {
      const msg = attempt === 0 ? await firstProof : await waitForControl(link, CODE_TTL_MS, (m) => m.type === 'auth-proof')
      const nJ = typeof msg.nJ === 'string' ? fromB64url(msg.nJ) : null
      const mac = typeof msg.mac === 'string' ? fromB64url(msg.mac) : null
      // One attempt per 2 s: hold the verdict rather than failing an honest quick retry.
      const wait = room.limiter.waitMs()
      if (wait > 0) await new Promise((r) => window.setTimeout(r, wait))
      room.limiter.begin()
      // fpH is ours (local), fpJ is theirs (remote).
      const ok = !!nJ && !!mac && nJ.length === 16 && (await verifyAuthMac(key, 'J', nH, nJ, fps.local, fps.remote, mac))
      if (ok && nJ) {
        const reply = await authMac(key, 'H', nH, nJ, fps.local, fps.remote)
        link.sendControl({ type: 'auth-ok', mac: b64url(reply) })
        passwordVerified = true
        L.info(`password verified for code ${room.code}`)
        break
      }
      const rotate = room.limiter.fail()
      L.warn(`wrong password on code ${room.code}`, { triesLeft: room.limiter.triesLeft })
      toast(`Wrong password attempt (${room.limiter.triesLeft} left)`)
      link.sendControl({ type: 'auth-fail', triesLeft: room.limiter.triesLeft })
      if (rotate) {
        L.warn(`too many failures, rotating code ${room.code}`)
        toast('Too many wrong tries — here’s a new code')
        link.close()
        rotateCode()
        return
      }
    }
  }

  const theirs = waitForControl(link, PEER_TIMEOUT_MS, isHello)
  sendUntil(link, helloMessage(), theirs)
  const hello = (await theirs) as HelloMessage
  const peer = await attachPeer(link, hello, { paired: true, passwordVerified })
  flashPeer(peer.deviceId)
  // The code is single-use: show a fresh one, keep this room alive for the peer that used it.
  if (hostRoom === room) rotateCode(true)
}

function openHostRoom(code: string): void {
  void roomId('code', code).then((id) => {
    if (host.value?.code !== code) return
    const room: HostRoom = {
      code,
      handle: trysteroSignaling.join(id, {
        onPeer(_peerId, pc) {
          const link = createPeerLink(pc)
          hostIntro(room, link).catch(() => link.close())
        },
        onPeerLeave() {},
      }),
      limiter: new AuthLimiter(),
      links: new Set(),
      expiry: window.setTimeout(() => {
        if (hostRoom === room) rotateCode()
      }, CODE_TTL_MS),
      retired: false,
    }
    hostRoom = room
  })
}

/** Start (or keep) hosting a code. Called when the pairing UI becomes visible. */
export function startHosting(): void {
  if (host.value) return
  const code = generateCode()
  host.value = { code, expiresAt: Date.now() + CODE_TTL_MS, locked: false, password: '', deriving: false }
  L.info(`hosting code ${code} (expires in ${CODE_TTL_MS / 60000} min)`)
  openHostRoom(code)
}

/** Replace the code in place (expiry, too many wrong tries, or after a successful pairing). */
export function rotateCode(keepRoomForPeers = false): void {
  const cur = host.value
  if (!cur) return
  if (hostRoom) {
    if (keepRoomForPeers) retire(hostRoom)
    else {
      window.clearTimeout(hostRoom.expiry)
      void hostRoom.handle.leave()
    }
    hostRoom = null
  }
  const code = generateCode()
  L.info(`code ${cur.code} → ${code}${keepRoomForPeers ? ' (old room kept for its peer)' : ''}`)
  host.value = { ...cur, code, expiresAt: Date.now() + CODE_TTL_MS }
  hostKey = null
  hostKeyFor = ''
  if (cur.locked && cur.password.length >= PASSWORD_MIN) void ensureHostKey(cur.password, code)
  openHostRoom(code)
}

/** Stop advertising. Rooms with connected peers stay alive until those peers leave. */
export function stopHosting(): void {
  if (!host.value) return
  L.info(`stopped hosting code ${host.value.code}`)
  if (hostRoom) retire(hostRoom)
  hostRoom = null
  host.value = null
  hostKey = null
  hostKeyFor = ''
}

export function setHostLocked(locked: boolean): void {
  const cur = host.value
  if (!cur) return
  const password = locked && !cur.password ? suggestPassword() : cur.password
  host.value = { ...cur, locked, password }
  if (locked && password.length >= PASSWORD_MIN) void ensureHostKey(password, cur.code)
}

export function setHostPassword(password: string): void {
  const cur = host.value
  if (!cur) return
  host.value = { ...cur, password }
  window.clearTimeout(hostPasswordTimer)
  if (cur.locked && password.length >= PASSWORD_MIN) {
    hostPasswordTimer = window.setTimeout(() => void ensureHostKey(password, cur.code), 400)
  }
}

export function newHostPassword(): void {
  setHostPassword(suggestPassword())
}

// ---- Joiner ------------------------------------------------------------------------------------

export type JoinStep = 'finding' | 'password' | 'opening'

export interface JoinState {
  code: string
  startedAt: number
  step: JoinStep
  hostName: string | null
  locked: boolean
  passwordChecked: boolean
  /** KDF or round-trip in flight. */
  checking: boolean
  triesLeft: number | null
  wrong: boolean
  /** Files or text captured before pairing; the Send sheet opens for the new peer. */
  intent: boolean
}

export interface SorryState {
  code: string
  cause: NatKind
  reason: 'timeout' | 'auth' | 'rotated' | 'closed'
}

export const joining = signal<JoinState | null>(null)
export const sorry = signal<SorryState | null>(null)

interface JoinSession {
  code: string
  handle: RoomHandle | null
  link: PeerLink | null
  timers: number[]
  password: ((pw: string) => void) | null
  done: boolean
  onPaired: (peer: Peer) => void
}

let joinSession: JoinSession | null = null

function patchJoin(patch: Partial<JoinState>): void {
  const cur = joining.value
  if (cur) joining.value = { ...cur, ...patch }
}

function endJoin(session: JoinSession): void {
  session.done = true
  for (const t of session.timers) window.clearTimeout(t)
  if (joinSession === session) joinSession = null
}

function failJoin(session: JoinSession, reason: SorryState['reason']): void {
  if (session.done) return
  L.error(`join ${session.code} failed: ${reason}`, { nat: nat.value, elapsedMs: Date.now() - (joining.value?.startedAt ?? Date.now()) })
  endJoin(session)
  session.link?.close()
  void session.handle?.leave()
  joining.value = null
  sorry.value = { code: session.code, cause: nat.value === 'checking' ? 'unknown' : nat.value, reason }
}

async function joinerIntro(session: JoinSession, link: PeerLink): Promise<void> {
  await link.ready
  if (session.done) {
    link.close()
    return
  }
  session.link = link
  for (const t of session.timers) window.clearTimeout(t)
  session.timers = []
  L.info(`found host for code ${session.code}, channel open`)
  patchJoin({ step: 'opening' })

  let first: ControlMessage
  try {
    first = await waitForControl(link, PEER_TIMEOUT_MS, (m) => m.type === 'auth-required' || isHello(m))
  } catch {
    failJoin(session, 'closed')
    return
  }

  let passwordVerified = false
  let hello: HelloMessage | null = null

  if (first.type === 'auth-required') {
    const nH = typeof first.nH === 'string' ? fromB64url(first.nH) : null
    const fps = link.fingerprints()
    if (!nH || nH.length !== 16 || !fps) {
      failJoin(session, 'auth')
      return
    }
    L.info('host requires a password')
    patchJoin({ step: 'password', locked: true, hostName: typeof first.name === 'string' ? first.name : null })

    for (;;) {
      const pw = await new Promise<string>((resolve) => {
        session.password = resolve
      })
      if (session.done) return
      patchJoin({ checking: true, wrong: false })
      try {
        const k0 = Date.now()
        const key = await deriveAuthKeyInWorker(pw, session.code)
        L.debug(`password key derived in ${Date.now() - k0} ms`)
        const nJ = randomNonce()
        // fpH is theirs (remote), fpJ is ours (local).
        const mac = await authMac(key, 'J', nH, nJ, fps.remote, fps.local)
        const reply = waitForControl(link, PEER_TIMEOUT_MS, (m) => m.type === 'auth-ok' || m.type === 'auth-fail')
        link.sendControl({ type: 'auth-proof', nJ: b64url(nJ), mac: b64url(mac) })
        const res = await reply
        if (res.type === 'auth-fail') {
          const triesLeft = typeof res.triesLeft === 'number' ? res.triesLeft : null
          L.warn('password rejected by host', { triesLeft })
          patchJoin({ checking: false, wrong: true, triesLeft })
          if (triesLeft === 0) {
            failJoin(session, 'rotated')
            return
          }
          continue
        }
        const hostMac = typeof res.mac === 'string' ? fromB64url(res.mac) : null
        const ok = !!hostMac && (await verifyAuthMac(key, 'H', nH, nJ, fps.remote, fps.local, hostMac))
        if (!ok) {
          failJoin(session, 'auth')
          return
        }
        passwordVerified = true
        L.info('password accepted, host proof verified')
        patchJoin({ checking: false, passwordChecked: true, step: 'opening' })
        break
      } catch {
        failJoin(session, 'closed')
        return
      }
    }
  } else {
    hello = first as HelloMessage
  }

  try {
    if (!hello) {
      const theirs = waitForControl(link, PEER_TIMEOUT_MS, isHello)
      link.sendControl(helloMessage())
      hello = (await theirs) as HelloMessage
    } else {
      link.sendControl(helloMessage())
    }
    const peer = await attachPeer(link, hello, { paired: true, passwordVerified })
    endJoin(session)
    joining.value = null
    L.info(`paired with ${peer.name} via code ${session.code}`)
    flashPeer(peer.deviceId)
    session.onPaired(peer)
  } catch {
    failJoin(session, 'closed')
  }
}

/** Join a code: used by typed codes, the scanner, the paste chip and pairing links. */
export function joinWithCode(code: string, opts: { intent?: boolean; onPaired: (peer: Peer) => void }): void {
  if (!isValidCode(code)) return
  if (joinSession) cancelJoin()
  sorry.value = null
  const session: JoinSession = {
    code,
    handle: null,
    link: null,
    timers: [],
    password: null,
    done: false,
    onPaired: opts.onPaired,
  }
  joinSession = session
  L.info(`joining code ${code}`, { intent: !!opts.intent, nat: nat.value })
  joining.value = {
    code,
    startedAt: Date.now(),
    step: 'finding',
    hostName: null,
    locked: false,
    passwordChecked: false,
    checking: false,
    triesLeft: null,
    wrong: false,
    intent: !!opts.intent,
  }

  void roomId('code', code).then((id) => {
    if (session.done) return
    session.handle = trysteroSignaling.join(id, {
      onPeer(_peerId, pc) {
        const link = createPeerLink(pc)
        joinerIntro(session, link).catch(() => link.close())
      },
      onPeerLeave() {},
      onError() {
        if (!session.link) failJoin(session, 'timeout')
      },
    })
    session.timers.push(
      window.setTimeout(() => {
        if (session.done || session.link) return
        L.warn(`no host after ${PAIR_TIMEOUT_MS / 1000} s, restarting ICE and waiting ${PAIR_RETRY_MS / 1000} s more`)
        for (const pc of Object.values(session.handle?.peers() ?? {})) {
          try {
            pc.restartIce()
          } catch {
            /* not restartable */
          }
        }
        session.timers.push(window.setTimeout(() => failJoin(session, 'timeout'), PAIR_RETRY_MS))
      }, PAIR_TIMEOUT_MS),
    )
  })
}

export function submitJoinPassword(password: string): void {
  joinSession?.password?.(password)
}

export function cancelJoin(): void {
  const s = joinSession
  if (!s) return
  L.info(`join ${s.code} cancelled`)
  endJoin(s)
  s.link?.close()
  void s.handle?.leave()
  joining.value = null
}

export function dismissSorry(): void {
  sorry.value = null
}
