import { signal } from '@preact/signals'

export type SendTab = 'files' | 'text'
export type PairTab = 'show' | 'scan'

export type SheetState =
  | null
  | { kind: 'send'; peerId: string; tab: SendTab }
  | { kind: 'pair'; tab: PairTab; prefill?: string }
  | { kind: 'peer'; peerId: string }

export const sheet = signal<SheetState>(null)

/** Files or text brought in before a device was chosen (share target, drop, paste, picker). */
export const pendingFiles = signal<File[]>([])
export const pendingText = signal<string | null>(null)

export const textReceived = signal<{ from: string; fromId: string; text: string } | null>(null)

/** True while something is being dragged over the window (desktop drop state). */
export const dragging = signal(false)

export function openSendSheet(peerId: string, tab: SendTab = 'files'): void {
  sheet.value = { kind: 'send', peerId, tab }
}

export function openPeerSheet(peerId: string): void {
  sheet.value = { kind: 'peer', peerId }
}

export function openPairSheet(tab: PairTab = 'show', prefill?: string): void {
  sheet.value = prefill ? { kind: 'pair', tab, prefill } : { kind: 'pair', tab }
}

export function closeSheet(): void {
  sheet.value = null
}

export function addPendingFiles(files: File[]): void {
  if (!files.length) return
  pendingFiles.value = [...pendingFiles.value, ...files]
}

export function clearPending(): void {
  pendingFiles.value = []
  pendingText.value = null
}

export function hasPending(): boolean {
  return pendingFiles.value.length > 0 || !!pendingText.value
}
