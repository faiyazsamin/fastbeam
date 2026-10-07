import { describe, expect, it } from 'vitest'
import { describeDevice, osFromPlatform } from './device'

const UA = {
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.52',
  pixelChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsungTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  androidReduced:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  cros: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

describe('describeDevice', () => {
  it('Mac + Chrome', () => {
    expect(describeDevice({ ua: UA.macChrome })).toEqual({ deviceType: 'desktop', os: 'macos', platform: 'Mac', browser: 'Chrome 129' })
  })
  it('Mac + Safari uses Version/ for the number', () => {
    expect(describeDevice({ ua: UA.macSafari })).toEqual({ deviceType: 'desktop', os: 'macos', platform: 'Mac', browser: 'Safari 18' })
  })
  it('Windows + Edge', () => {
    expect(describeDevice({ ua: UA.winEdge })).toEqual({ deviceType: 'desktop', os: 'windows', platform: 'Windows', browser: 'Edge 129' })
  })
  it('Pixel phone keeps the model', () => {
    expect(describeDevice({ ua: UA.pixelChrome })).toEqual({ deviceType: 'phone', os: 'android', platform: 'Pixel 8', browser: 'Chrome 129' })
  })
  it('Android without "Mobile" is a tablet', () => {
    expect(describeDevice({ ua: UA.samsungTablet })).toEqual({ deviceType: 'tablet', os: 'android', platform: 'SM-X710', browser: 'Chrome 128' })
  })
  it('reduced Android UA ("K") falls back to a generic label', () => {
    expect(describeDevice({ ua: UA.androidReduced })).toEqual({
      deviceType: 'phone',
      os: 'android',
      platform: 'Android phone',
      browser: 'Chrome 129',
    })
  })
  it('iPhone Safari and Chrome', () => {
    expect(describeDevice({ ua: UA.iphoneSafari })).toEqual({ deviceType: 'phone', os: 'ios', platform: 'iPhone', browser: 'Safari 17' })
    expect(describeDevice({ ua: UA.iphoneChrome })).toEqual({ deviceType: 'phone', os: 'ios', platform: 'iPhone', browser: 'Chrome 129' })
  })
  it('iPad, including the desktop-site Mac UA with touch', () => {
    expect(describeDevice({ ua: UA.ipadSafari })).toEqual({ deviceType: 'tablet', os: 'ios', platform: 'iPad', browser: 'Safari 17' })
    expect(describeDevice({ ua: UA.macSafari, maxTouchPoints: 5 })).toEqual({
      deviceType: 'tablet',
      os: 'ios',
      platform: 'iPad',
      browser: 'Safari 18',
    })
  })
  it('headless Chrome still counts as Chrome', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36'
    expect(describeDevice({ ua })).toEqual({ deviceType: 'desktop', os: 'macos', platform: 'Mac', browser: 'Chrome 131' })
  })
  it('Linux Firefox and Chromebook', () => {
    expect(describeDevice({ ua: UA.linuxFirefox })).toEqual({ deviceType: 'desktop', os: 'linux', platform: 'Linux', browser: 'Firefox 130' })
    expect(describeDevice({ ua: UA.cros })).toEqual({ deviceType: 'desktop', os: 'chromeos', platform: 'Chromebook', browser: 'Chrome 129' })
  })
})

describe('osFromPlatform (older peers without an os field)', () => {
  it('infers from the label', () => {
    expect(osFromPlatform('iPhone', 'phone')).toBe('ios')
    expect(osFromPlatform('Mac', 'desktop')).toBe('macos')
    expect(osFromPlatform('Windows', 'desktop')).toBe('windows')
    expect(osFromPlatform('Pixel 8', 'phone')).toBe('android')
    expect(osFromPlatform('SM-X710', 'tablet')).toBe('android')
    expect(osFromPlatform('Chromebook', 'desktop')).toBe('chromeos')
    expect(osFromPlatform('Device', 'desktop')).toBe('other')
  })
})
