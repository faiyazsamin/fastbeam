/** Startup side effects: discovery, pairing links, share target, drag/paste capture, transfer guards. */
import { initDiscovery } from './net/discovery'
import { codeFromHash, joinWithCode } from './net/pairing'
import { initSessionBroadcast } from './net/session'
import { addPendingFiles, dragging, hasPending, pendingText } from './state/ui'
import { initTransferGuards } from './transfer/manager'
import { onPairedDefault } from './ui/sheets/PairSheet'

export const SHARE_CACHE = 'fastbeam-share'

async function consumeShareTarget(): Promise<void> {
  const params = new URLSearchParams(location.search)
  if (!params.has('share')) return
  history.replaceState(history.state, '', location.pathname + location.hash)
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(SHARE_CACHE)
    const keys = await cache.keys()
    const files: File[] = []
    let text: string | null = null
    for (const req of keys) {
      const res = await cache.match(req)
      if (!res) continue
      const kind = res.headers.get('x-fastbeam-kind')
      if (kind === 'text') text = await res.text()
      else {
        const name = decodeURIComponent(res.headers.get('x-fastbeam-name') ?? 'shared')
        const type = res.headers.get('content-type') ?? ''
        files.push(new File([await res.blob()], name, { type }))
      }
    }
    await caches.delete(SHARE_CACHE)
    if (files.length) addPendingFiles(files)
    else if (text) pendingText.value = text
  } catch {
    /* nothing shared after all */
  }
}

function initDragAndPaste(): void {
  let depth = 0
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return
    depth++
    dragging.value = true
  })
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) dragging.value = false
  })
  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  })
  window.addEventListener('drop', (e) => {
    depth = 0
    dragging.value = false
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    // Tiles handle their own drops; anything else waits for a tile tap.
    if ((e.target as HTMLElement | null)?.closest?.('.tile')) return
    addPendingFiles(Array.from(e.dataTransfer.files))
  })

  document.addEventListener('paste', (e) => {
    const target = e.target as HTMLElement | null
    if (target && (target.closest('input, textarea, [contenteditable="true"]') ?? null)) return
    const files = Array.from(e.clipboardData?.files ?? [])
    if (files.length) {
      e.preventDefault()
      addPendingFiles(files)
      return
    }
    const text = e.clipboardData?.getData('text/plain')?.trim()
    if (text) {
      e.preventDefault()
      pendingText.value = text
    }
  })
}

function consumePairLink(): void {
  const code = codeFromHash(location.hash)
  if (!code) return
  history.replaceState(history.state, '', location.pathname + location.search)
  joinWithCode(code, { intent: hasPending(), onPaired: onPairedDefault })
}

export function boot(): void {
  initSessionBroadcast()
  initTransferGuards()
  initDragAndPaste()
  void consumeShareTarget().then(() => consumePairLink())
  initDiscovery()
}
