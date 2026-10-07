import { lastProbe } from '../net/discovery'
import { device, deviceId } from './identity'
import { diagnosticsText } from './log'
import { nat } from './network'
import { peers } from './peers'
import { deviceName } from './settings'
import { toast } from './toast'

export function diagnosticsHeader(): string[] {
  const probe = lastProbe.value
  const list = [...peers.value.values()]
  return [
    `fastbeam ${__APP_VERSION__} · ${device.platform} · ${device.browser} · ${device.deviceType}`,
    `device ${deviceId.value} "${deviceName.value}" · nat ${nat.value} · ipv4 ${probe?.ipv4 ?? '-'} · ipv6/64 ${probe?.ipv6Prefix ?? '-'}`,
    `peers ${list.map((p) => `${p.name}(${p.online ? 'online' : 'reconnecting'}, ${p.links.length} link${p.links.length === 1 ? '' : 's'})`).join(' ') || 'none'}`,
    `page ${location.href} · ${new Date().toISOString()}`,
  ]
}

/** Copy the last `count` console lines with a device summary. Works on any device, console open or not. */
export async function copyDiagnostics(count = 120): Promise<void> {
  const text = diagnosticsText(count, diagnosticsHeader())
  try {
    await navigator.clipboard.writeText(text)
    toast(`Copied the last ${Math.min(count, text.split('\n').length)} console lines`)
  } catch {
    toast('Couldn’t copy. Open the console and select the text instead.')
  }
}
