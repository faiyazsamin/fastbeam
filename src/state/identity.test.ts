import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('identity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('creates a UUID device id once and keeps it', async () => {
    const a = await import('./identity')
    expect(a.deviceId.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    vi.resetModules()
    const b = await import('./identity')
    expect(b.deviceId.value).toBe(a.deviceId.value)
  })
})
