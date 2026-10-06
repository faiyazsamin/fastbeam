import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('generates a name on first load and persists it', async () => {
    const a = await import('./settings')
    const first = a.deviceName.value
    expect(first).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    expect(JSON.parse(localStorage.getItem('fastbeam:name') ?? 'null')).toBe(first)

    vi.resetModules()
    const b = await import('./settings')
    expect(b.deviceName.value).toBe(first)
  })

  it('setDeviceName normalises input and rejects empty', async () => {
    const s = await import('./settings')
    expect(s.setDeviceName('  My   Laptop ')).toBe(true)
    expect(s.deviceName.value).toBe('My Laptop')
    expect(s.setDeviceName('   ')).toBe(false)
    expect(s.deviceName.value).toBe('My Laptop')
  })

  it('shuffleName changes the name', async () => {
    const s = await import('./settings')
    s.setDeviceName('Fixed Name')
    s.shuffleName()
    expect(s.deviceName.value).not.toBe('Fixed Name')
  })

  it('ignores invalid stored values', async () => {
    localStorage.setItem('fastbeam:theme', JSON.stringify('neon'))
    localStorage.setItem('fastbeam:discoverable', JSON.stringify('yes'))
    const s = await import('./settings')
    expect(s.theme.value).toBe('system')
    expect(s.discoverable.value).toBe(true)
  })
})
