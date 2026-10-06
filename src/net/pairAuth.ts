/**
 * Password-protected pairing (build-notes §4). Everything here is WebCrypto; the KDF runs in a worker
 * (pairAuth.worker.ts) so the UI can show "Checking…" without jank.
 *
 *   ikm   = PBKDF2-SHA-256(NFKC(trim(password)), salt = "fastbeam/pair/v1/" + CODE, 600000 iterations, 256 bits)
 *   kAuth = HKDF-SHA-256(ikm, salt = empty, info = "fastbeam auth")  → HMAC-SHA-256 key
 *   proof = HMAC(kAuth, role ‖ nH ‖ nJ ‖ fpH ‖ fpJ)     role = "J" (joiner) or "H" (host)
 *
 * nH/nJ are 16 random bytes each; fpH/fpJ are the upper-case colon-separated DTLS fingerprints taken from
 * the SDP on both sides, so a relay that swapped certificates fails the check on both ends.
 */

import { AUTH_MAX_FAILURES, AUTH_MIN_INTERVAL_MS } from '../config'
import { concatBytes, utf8 } from './hash'

export const KDF_ITERATIONS = 600_000
export const KDF_SALT_PREFIX = 'fastbeam/pair/v1/'
export const HKDF_INFO = 'fastbeam auth'

export type AuthRole = 'H' | 'J'

export function normalizePassword(raw: string): string {
  return raw.trim().normalize('NFKC')
}

export async function pbkdf2(password: Uint8Array, salt: Uint8Array, iterations: number, bits: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', password as BufferSource, 'PBKDF2', false, ['deriveBits'])
  const out = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    bits,
  )
  return new Uint8Array(out)
}

export async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, bits: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const out = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    bits,
  )
  return new Uint8Array(out)
}

export async function importHmacKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function hmac(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data as BufferSource))
}

/** Raw 32-byte kAuth. Slow by design (~0.3–1 s on a phone); call from the worker. */
export async function deriveAuthKeyBytes(password: string, code: string): Promise<Uint8Array> {
  const ikm = await pbkdf2(utf8(normalizePassword(password)), utf8(KDF_SALT_PREFIX + code.toUpperCase()), KDF_ITERATIONS, 256)
  return hkdf(ikm, new Uint8Array(0), utf8(HKDF_INFO), 256)
}

export async function deriveAuthKey(password: string, code: string): Promise<CryptoKey> {
  return importHmacKey(await deriveAuthKeyBytes(password, code))
}

export function randomNonce(): Uint8Array {
  const n = new Uint8Array(16)
  crypto.getRandomValues(n)
  return n
}

export function authTranscript(role: AuthRole, nH: Uint8Array, nJ: Uint8Array, fpH: string, fpJ: string): Uint8Array {
  return concatBytes(utf8(role), nH, nJ, utf8(fpH.toUpperCase()), utf8(fpJ.toUpperCase()))
}

export async function authMac(
  key: CryptoKey,
  role: AuthRole,
  nH: Uint8Array,
  nJ: Uint8Array,
  fpH: string,
  fpJ: string,
): Promise<Uint8Array> {
  return hmac(key, authTranscript(role, nH, nJ, fpH, fpJ))
}

/** Constant-time check via crypto.subtle.verify. */
export async function verifyAuthMac(
  key: CryptoKey,
  role: AuthRole,
  nH: Uint8Array,
  nJ: Uint8Array,
  fpH: string,
  fpJ: string,
  mac: Uint8Array,
): Promise<boolean> {
  if (mac.length !== 32) return false
  return crypto.subtle.verify('HMAC', key, mac as BufferSource, authTranscript(role, nH, nJ, fpH, fpJ) as BufferSource)
}

/** Host-side throttle: one attempt per 2 s, five failures per code, then the code rotates. */
export class AuthLimiter {
  failures = 0
  private lastAttempt = -Infinity

  constructor(
    private readonly minIntervalMs = AUTH_MIN_INTERVAL_MS,
    private readonly maxFailures = AUTH_MAX_FAILURES,
  ) {}

  get triesLeft(): number {
    return Math.max(0, this.maxFailures - this.failures)
  }

  /** Milliseconds the host should wait before judging the next attempt (0 when allowed now). */
  waitMs(now = Date.now()): number {
    return Math.max(0, this.minIntervalMs - (now - this.lastAttempt))
  }

  /** Returns false when the attempt arrives too soon after the previous one. */
  begin(now = Date.now()): boolean {
    if (now - this.lastAttempt < this.minIntervalMs) return false
    this.lastAttempt = now
    return true
  }

  /** Record a failure; returns true when the code must rotate. */
  fail(): boolean {
    this.failures++
    return this.failures >= this.maxFailures
  }
}

// ---- Worker bridge -------------------------------------------------------------------------------

let worker: Worker | null = null

/** Derive kAuth off the main thread. Falls back to the main thread where workers are unavailable. */
export async function deriveAuthKeyInWorker(password: string, code: string): Promise<CryptoKey> {
  if (typeof Worker === 'undefined') return deriveAuthKey(password, code)
  worker ??= new Worker(new URL('./pairAuth.worker.ts', import.meta.url), { type: 'module' })
  const w = worker
  const id = Math.random().toString(36).slice(2)
  const raw = await new Promise<Uint8Array>((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ id: string; key?: ArrayBuffer; error?: string }>) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMessage)
      if (e.data.key) resolve(new Uint8Array(e.data.key))
      else reject(new Error(e.data.error ?? 'kdf failed'))
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ id, password, code })
  })
  return importHmacKey(raw)
}
