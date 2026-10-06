// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  decodeChunk,
  encodeChunk,
  formatBytes,
  sanitizeFileName,
  sanitizeRelPath,
  singleUrl,
  verificationCode,
} from './protocol'

describe('chunk framing', () => {
  it('round-trips the file index and payload', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const frame = encodeChunk(7, data)
    expect(frame.byteLength).toBe(10)
    const out = decodeChunk(frame)
    expect(out?.fileIndex).toBe(7)
    expect(Array.from(out!.data)).toEqual([1, 2, 3, 4, 5])
  })
  it('rejects short or unknown frames', () => {
    expect(decodeChunk(new ArrayBuffer(3))).toBeNull()
    const bad = new Uint8Array([9, 0, 0, 0, 0, 1]).buffer
    expect(decodeChunk(bad)).toBeNull()
  })
})

describe('sanitizeFileName', () => {
  it('strips paths, control chars and leading dots', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('C:\\Users\\x\\.hidden')).toBe('hidden')
    expect(sanitizeFileName('a\u0000b<c>.txt')).toBe('abc.txt')
    expect(sanitizeFileName('   ')).toBe('file')
  })
  it('keeps only safe folder segments from relPath', () => {
    expect(sanitizeRelPath('trip/photos/../IMG.jpg')).toEqual(['trip', 'photos'])
    expect(sanitizeRelPath('IMG.jpg')).toEqual([])
    expect(sanitizeRelPath(undefined)).toEqual([])
  })
})

describe('formatBytes', () => {
  it('uses decimal units like the designs', () => {
    expect(formatBytes(312_000)).toBe('312 KB')
    expect(formatBytes(4_200_000)).toBe('4.2 MB')
    expect(formatBytes(231_000_000)).toBe('231 MB')
    expect(formatBytes(2_000_000_000)).toBe('2.0 GB')
  })
})

describe('verificationCode', () => {
  it('is symmetric and six digits', async () => {
    const a = 'AA:BB:CC'
    const b = '11:22:33'
    const x = await verificationCode(a, b)
    expect(x).toMatch(/^\d{3} \d{3}$/)
    expect(await verificationCode(b, a)).toBe(x)
    expect(await verificationCode(a, 'FF:EE')).not.toBe(x)
  })
})

describe('singleUrl', () => {
  it('detects a lone http(s) URL', () => {
    expect(singleUrl(' https://fastbeam.app/#K7QX4M ')).toBe('https://fastbeam.app/#K7QX4M')
    expect(singleUrl('see https://example.com')).toBeNull()
    expect(singleUrl('javascript:alert(1)')).toBeNull()
  })
})
