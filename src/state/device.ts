export type DeviceType = 'phone' | 'tablet' | 'desktop'
export type DeviceOs = 'ios' | 'macos' | 'windows' | 'android' | 'linux' | 'chromeos' | 'other'

export interface DeviceInfo {
  deviceType: DeviceType
  os: DeviceOs
  /** Short platform label for tile subtitles: "Mac", "Pixel 8", "iPad", "Windows". */
  platform: string
  /** Browser name and major version: "Chrome 129". */
  browser: string
}

/** Best guess at the OS from a platform label, for peers that predate the `os` field. */
export function osFromPlatform(platform: string, deviceType: DeviceType): DeviceOs {
  const p = platform.toLowerCase()
  if (/iphone|ipad|ipod/.test(p)) return 'ios'
  if (/^mac/.test(p)) return 'macos'
  if (/windows/.test(p)) return 'windows'
  if (/android|pixel|galaxy|^sm-|oneplus|xiaomi|redmi|moto/.test(p)) return 'android'
  if (/chromebook|cros/.test(p)) return 'chromeos'
  if (/linux/.test(p)) return 'linux'
  return deviceType === 'desktop' ? 'other' : 'android'
}

export interface DeviceSignals {
  ua: string
  /** navigator.userAgentData.platform when available. */
  uaPlatform?: string | undefined
  /** navigator.userAgentData.mobile when available. */
  uaMobile?: boolean | undefined
  maxTouchPoints?: number | undefined
}

function browserFrom(ua: string): string {
  const m = (re: RegExp): string | undefined => re.exec(ua)?.[1]
  const major = (v: string | undefined): string => (v ? ` ${v.split('.')[0]}` : '')

  if (/\bEdg(?:e|A|iOS)?\//.test(ua)) return `Edge${major(m(/\bEdg(?:e|A|iOS)?\/([\d.]+)/))}`
  if (/\bOPR\//.test(ua)) return `Opera${major(m(/\bOPR\/([\d.]+)/))}`
  if (/\bSamsungBrowser\//.test(ua)) return `Samsung Internet${major(m(/\bSamsungBrowser\/([\d.]+)/))}`
  if (/\bFxiOS\//.test(ua)) return `Firefox${major(m(/\bFxiOS\/([\d.]+)/))}`
  if (/\bFirefox\//.test(ua)) return `Firefox${major(m(/\bFirefox\/([\d.]+)/))}`
  if (/\bCriOS\//.test(ua)) return `Chrome${major(m(/\bCriOS\/([\d.]+)/))}`
  if (/Chrome\//.test(ua)) return `Chrome${major(m(/Chrome\/([\d.]+)/))}`
  if (/\bSafari\//.test(ua)) return `Safari${major(m(/\bVersion\/([\d.]+)/))}`
  return 'Browser'
}

function androidModel(ua: string): string | undefined {
  // "Android 14; Pixel 8 Build/..." or "Android 13; SM-X710)"
  const r = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/|\))/.exec(ua)
  const model = r?.[1]?.trim()
  // Chrome's reduced UA reports the model as "K"; locale-only values also carry no information.
  if (!model || model === 'K' || /^[a-z]{2}(?:-[a-z]{2})?$/i.test(model)) return undefined
  return model
}

export function describeDevice(s: DeviceSignals): DeviceInfo {
  const ua = s.ua
  const touch = s.maxTouchPoints ?? 0
  const browser = browserFrom(ua)

  if (/\biPad\b/.test(ua)) return { deviceType: 'tablet', os: 'ios', platform: 'iPad', browser }
  if (/\biPhone\b/.test(ua)) return { deviceType: 'phone', os: 'ios', platform: 'iPhone', browser }
  if (/\biPod\b/.test(ua)) return { deviceType: 'phone', os: 'ios', platform: 'iPod touch', browser }

  if (/\bAndroid\b/.test(ua)) {
    const isPhone = /\bMobile\b/.test(ua) || s.uaMobile === true
    const platform = androidModel(ua) ?? (isPhone ? 'Android phone' : 'Android tablet')
    return { deviceType: isPhone ? 'phone' : 'tablet', os: 'android', platform, browser }
  }

  if (/\bMacintosh\b/.test(ua) || s.uaPlatform === 'macOS') {
    // iPadOS asks for desktop sites with a Mac UA; touch gives it away.
    if (touch > 1) return { deviceType: 'tablet', os: 'ios', platform: 'iPad', browser }
    return { deviceType: 'desktop', os: 'macos', platform: 'Mac', browser }
  }
  if (/\bWindows\b/.test(ua) || s.uaPlatform === 'Windows') {
    return { deviceType: 'desktop', os: 'windows', platform: 'Windows', browser }
  }
  if (/\bCrOS\b/.test(ua) || s.uaPlatform === 'Chrome OS') {
    return { deviceType: 'desktop', os: 'chromeos', platform: 'Chromebook', browser }
  }
  if (/\bLinux\b/.test(ua) || s.uaPlatform === 'Linux') {
    return { deviceType: 'desktop', os: 'linux', platform: 'Linux', browser }
  }
  return { deviceType: s.uaMobile ? 'phone' : 'desktop', os: 'other', platform: 'Device', browser }
}

interface NavigatorUAData {
  platform?: string
  mobile?: boolean
}

export function detectDevice(): DeviceInfo {
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData }
  return describeDevice({
    ua: nav.userAgent,
    uaPlatform: nav.userAgentData?.platform,
    uaMobile: nav.userAgentData?.mobile,
    maxTouchPoints: nav.maxTouchPoints,
  })
}
