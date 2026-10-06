// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { b64url, base32, fromB64url, fromHex, hex, roomId, sha256 } from './hash'

describe('hash utils', () => {
  it('sha256 of empty string', async () => {
    expect(hex(await sha256(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
  it('base32 RFC 4648 vectors (unpadded)', () => {
    const enc = (s: string) => base32(new TextEncoder().encode(s))
    expect(enc('')).toBe('')
    expect(enc('f')).toBe('MY')
    expect(enc('fo')).toBe('MZXQ')
    expect(enc('foo')).toBe('MZXW6')
    expect(enc('foobar')).toBe('MZXW6YTBOI')
  })
  it('base64url round trip', () => {
    const bytes = fromHex('00ff10203040fffe')
    expect(fromB64url(b64url(bytes))).toEqual(bytes)
    expect(b64url(bytes)).not.toMatch(/[+/=]/)
  })
  it('room ids are 20 chars, salted and kind-separated', async () => {
    const a = await roomId('v4', '203.0.113.7')
    const b = await roomId('v6', '203.0.113.7')
    const c = await roomId('code', 'K7QX4M')
    expect(a).toMatch(/^[A-Z2-7]{20}$/)
    expect(a).not.toBe(b)
    expect(c).not.toBe(a)
    expect(await roomId('code', 'K7QX4M')).toBe(c)
  })
})
