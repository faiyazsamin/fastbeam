import { ICE_SERVERS, IP_LOOKUP_URL, STUN_PROBE_MS } from '../config'

export type NatKind = 'open' | 'symmetric' | 'udp-blocked' | 'unknown'

export interface ProbeResult {
  ipv4?: string
  /** First four groups of a public IPv6 address, normalised ("2001:db8:abcd:12"). */
  ipv6Prefix?: string
  nat: NatKind
}

interface Srflx {
  address: string
  port: number
  base: string
}

/** Parse the fields we need from a candidate line. Returns null for anything that is not srflx. */
export function parseSrflx(candidate: string): Srflx | null {
  const parts = candidate.trim().split(/\s+/)
  if (parts.length < 8) return null
  const typIdx = parts.indexOf('typ')
  if (typIdx < 0 || parts[typIdx + 1] !== 'srflx') return null
  const address = parts[4] ?? ''
  const port = Number(parts[5])
  const rIdx = parts.indexOf('raddr')
  const rpIdx = parts.indexOf('rport')
  const base = `${rIdx >= 0 ? parts[rIdx + 1] : '?'}:${rpIdx >= 0 ? parts[rpIdx + 1] : '?'}`
  if (!address || !Number.isFinite(port)) return null
  return { address, port, base }
}

/** Expand an IPv6 address and return its /64 prefix as four lower-case groups without leading zeros. */
export function ipv6Prefix64(addr: string): string | undefined {
  const a = addr.replace(/^\[|\]$/g, '').split('%')[0] ?? ''
  if (!a.includes(':')) return undefined
  const halves = a.split('::')
  if (halves.length > 2) return undefined
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (missing < 0) return undefined
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (groups.length !== 8) return undefined
  return groups
    .slice(0, 4)
    .map((g) => (g || '0').toLowerCase().replace(/^0+(?=.)/, ''))
    .join(':')
}

function isIPv4(addr: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(addr)
}

/** Classify the NAT from the reflexive candidates gathered for one local socket. */
export function classifyNat(candidates: readonly Srflx[]): NatKind {
  const v4 = candidates.filter((c) => isIPv4(c.address))
  if (v4.length === 0) return candidates.length === 0 ? 'udp-blocked' : 'open'
  const byBase = new Map<string, Set<number>>()
  for (const c of v4) {
    const set = byBase.get(c.base) ?? new Set<number>()
    set.add(c.port)
    byBase.set(c.base, set)
  }
  // Browsers collapse identical mapped addresses, so two different ports for one base means symmetric.
  for (const ports of byBase.values()) if (ports.size > 1) return 'symmetric'
  return 'open'
}

async function lookupPublicIp(ms: number): Promise<string | undefined> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(IP_LOOKUP_URL, { signal: ctl.signal, cache: 'no-store' })
    const json = (await res.json()) as { ip?: string }
    return typeof json.ip === 'string' ? json.ip : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(t)
  }
}

/**
 * One STUN pass: public IPv4, IPv6 /64 and a NAT guess. Runs once at startup and again on "Run again".
 */
export async function stunProbe(timeoutMs = STUN_PROBE_MS): Promise<ProbeResult> {
  if (typeof RTCPeerConnection === 'undefined') return { nat: 'unknown' }
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const found: Srflx[] = []
  const done = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        clearTimeout(timer)
        resolve()
        return
      }
      const s = parseSrflx(e.candidate.candidate)
      if (s) found.push(s)
    }
  })
  try {
    pc.createDataChannel('probe')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await done
  } catch {
    // fall through with whatever we gathered
  } finally {
    pc.close()
  }

  const result: ProbeResult = { nat: classifyNat(found) }
  const v4 = found.find((c) => isIPv4(c.address))
  if (v4) result.ipv4 = v4.address
  const v6 = found.map((c) => ipv6Prefix64(c.address)).find((p): p is string => !!p)
  if (v6) result.ipv6Prefix = v6

  if (!result.ipv4 && !result.ipv6Prefix) {
    const ip = await lookupPublicIp(timeoutMs)
    if (ip && isIPv4(ip)) result.ipv4 = ip
    else if (ip) {
      const p = ipv6Prefix64(ip)
      if (p) result.ipv6Prefix = p
    }
    result.nat = 'udp-blocked'
  }
  return result
}
