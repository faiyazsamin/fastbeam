import { describe, expect, it } from 'vitest'
import { classifyNat, ipv6Prefix64, parseSrflx } from './stunProbe'

const cand = (addr: string, port: number, rport = 50000) =>
  `candidate:842163049 1 udp 1677729535 ${addr} ${port} typ srflx raddr 192.168.1.10 rport ${rport} generation 0 ufrag abcd network-cost 999`

describe('parseSrflx', () => {
  it('reads address, port and base from a srflx candidate', () => {
    expect(parseSrflx(cand('203.0.113.7', 61000))).toEqual({ address: '203.0.113.7', port: 61000, base: '192.168.1.10:50000' })
  })
  it('ignores host and relay candidates', () => {
    expect(parseSrflx('candidate:1 1 udp 2122260223 192.168.1.10 50000 typ host generation 0')).toBeNull()
  })
})

describe('classifyNat', () => {
  it('udp-blocked with no reflexive candidates', () => {
    expect(classifyNat([])).toBe('udp-blocked')
  })
  it('open when both servers map to the same port (collapsed to one candidate)', () => {
    expect(classifyNat([parseSrflx(cand('203.0.113.7', 61000))!])).toBe('open')
  })
  it('symmetric when the same socket gets two different mapped ports', () => {
    expect(classifyNat([parseSrflx(cand('203.0.113.7', 61000))!, parseSrflx(cand('203.0.113.7', 61001))!])).toBe('symmetric')
  })
  it('two sockets with one port each is still open', () => {
    expect(classifyNat([parseSrflx(cand('203.0.113.7', 61000, 50000))!, parseSrflx(cand('203.0.113.7', 61001, 50001))!])).toBe('open')
  })
})

describe('ipv6Prefix64', () => {
  it('normalises and keeps the first four groups', () => {
    expect(ipv6Prefix64('2001:0db8:ABCD:0012:0000:0000:0000:0001')).toBe('2001:db8:abcd:12')
    expect(ipv6Prefix64('2001:db8:abcd:12::1')).toBe('2001:db8:abcd:12')
    expect(ipv6Prefix64('2001:db8::1')).toBe('2001:db8:0:0')
    expect(ipv6Prefix64('[fe80::1%en0]')).toBe('fe80:0:0:0')
  })
  it('rejects IPv4 and garbage', () => {
    expect(ipv6Prefix64('203.0.113.7')).toBeUndefined()
    expect(ipv6Prefix64('1::2::3')).toBeUndefined()
  })
})
