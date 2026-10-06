// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fromHex, hex, utf8 } from './hash'
import {
  AuthLimiter,
  authMac,
  deriveAuthKey,
  deriveAuthKeyBytes,
  hkdf,
  hmac,
  importHmacKey,
  pbkdf2,
  randomNonce,
  verifyAuthMac,
} from './pairAuth'

const FP_H = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
const FP_J = '99:88:77:66:55:44:33:22:11:00:FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00:FF:EE:DD:CC:BB:AA'
const FP_X = '01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF'

describe('primitives (known-answer vectors)', () => {
  it('PBKDF2-HMAC-SHA-256 matches RFC 7914 §11', async () => {
    const out = await pbkdf2(utf8('passwd'), utf8('salt'), 1, 256)
    expect(hex(out)).toBe('55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc')
  })

  it('HKDF-SHA-256 matches RFC 5869 test case 1', async () => {
    const ikm = new Uint8Array(22).fill(0x0b)
    const salt = fromHex('000102030405060708090a0b0c')
    const info = fromHex('f0f1f2f3f4f5f6f7f8f9')
    const okm = await hkdf(ikm, salt, info, 42 * 8)
    expect(hex(okm)).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865')
  })

  it('HMAC-SHA-256 matches RFC 4231 test case 2', async () => {
    const key = await importHmacKey(utf8('Jefe'))
    const mac = await hmac(key, utf8('what do ya want for nothing?'))
    expect(hex(mac)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })
})

describe('key derivation', () => {
  it('is deterministic, code-bound and password-normalised', async () => {
    const a = await deriveAuthKeyBytes('otter-pancake', 'K7QX4M')
    const b = await deriveAuthKeyBytes('  otter-pancake ', 'k7qx4m')
    const c = await deriveAuthKeyBytes('otter-pancake', 'K7QX4N')
    const d = await deriveAuthKeyBytes('otter-pancakes', 'K7QX4M')
    expect(a).toHaveLength(32)
    expect(hex(b)).toBe(hex(a))
    expect(hex(c)).not.toBe(hex(a))
    expect(hex(d)).not.toBe(hex(a))
  }, 30_000)
})

describe('handshake', () => {
  const nH = randomNonce()
  const nJ = randomNonce()

  it('matching passwords verify in both directions', async () => {
    const host = await deriveAuthKey('otter-pancake', 'K7QX4M')
    const joiner = await deriveAuthKey('otter-pancake', 'K7QX4M')
    const proof = await authMac(joiner, 'J', nH, nJ, FP_H, FP_J)
    expect(await verifyAuthMac(host, 'J', nH, nJ, FP_H, FP_J, proof)).toBe(true)
    const ok = await authMac(host, 'H', nH, nJ, FP_H, FP_J)
    expect(await verifyAuthMac(joiner, 'H', nH, nJ, FP_H, FP_J, ok)).toBe(true)
    // Roles are domain-separated: a joiner proof never passes as a host proof.
    expect(await verifyAuthMac(joiner, 'H', nH, nJ, FP_H, FP_J, proof)).toBe(false)
  }, 30_000)

  it('a wrong password fails', async () => {
    const host = await deriveAuthKey('otter-pancake', 'K7QX4M')
    const joiner = await deriveAuthKey('otter-pancakes', 'K7QX4M')
    const proof = await authMac(joiner, 'J', nH, nJ, FP_H, FP_J)
    expect(await verifyAuthMac(host, 'J', nH, nJ, FP_H, FP_J, proof)).toBe(false)
  }, 30_000)

  it('a relay that swapped a fingerprint fails on both ends', async () => {
    const host = await deriveAuthKey('otter-pancake', 'K7QX4M')
    const joiner = await deriveAuthKey('otter-pancake', 'K7QX4M')
    // Joiner sees the relay's certificate as the host's.
    const proof = await authMac(joiner, 'J', nH, nJ, FP_X, FP_J)
    expect(await verifyAuthMac(host, 'J', nH, nJ, FP_H, FP_J, proof)).toBe(false)
    // And even if the host's reply were forwarded, the joiner's view of the transcript differs.
    const ok = await authMac(host, 'H', nH, nJ, FP_H, FP_X)
    expect(await verifyAuthMac(joiner, 'H', nH, nJ, FP_H, FP_J, ok)).toBe(false)
  }, 30_000)

  it('rejects malformed macs without throwing', async () => {
    const host = await deriveAuthKey('otter-pancake', 'K7QX4M')
    expect(await verifyAuthMac(host, 'J', nH, nJ, FP_H, FP_J, new Uint8Array(5))).toBe(false)
  }, 30_000)
})

describe('AuthLimiter', () => {
  it('allows one attempt per interval and rotates after five failures', () => {
    const l = new AuthLimiter(2000, 5)
    expect(l.begin(10_000)).toBe(true)
    expect(l.begin(11_000)).toBe(false)
    expect(l.begin(12_000)).toBe(true)
    expect(l.fail()).toBe(false)
    expect(l.triesLeft).toBe(4)
    l.fail()
    l.fail()
    l.fail()
    expect(l.triesLeft).toBe(1)
    expect(l.fail()).toBe(true)
    expect(l.triesLeft).toBe(0)
  })
})
