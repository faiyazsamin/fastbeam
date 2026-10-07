import { BlobSink } from './blob'
import { FsAccessSink, fsAccessSupported } from './fsAccess'
import { OpfsSink, opfsSupported } from './opfs'
import { SwStreamSink, swStreamSupported } from './swStream'
import type { Sink, SinkKind } from './types'

export type { SavedFile, Sink, SinkKind } from './types'
export { cleanupOpfs, probeOpfs } from './opfs'

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Test hook: `localStorage['fastbeam:sink'] = '"blob"'` forces a sink (headless browsers cannot show pickers). */
function forcedSink(): SinkKind | null {
  try {
    const v = JSON.parse(localStorage.getItem('fastbeam:sink') ?? 'null') as unknown
    return v === 'fs' || v === 'sw' || v === 'opfs' || v === 'blob' ? v : null
  } catch {
    return null
  }
}

/**
 * First sink the browser supports, all of them streaming except the last:
 *   File System Access (Chromium desktop) → service-worker download (Chrome Android, Firefox)
 *   → private storage + disk-backed Save (Safari, iOS, anything with OPFS) → in-memory Blob.
 */
export function chooseSinkKind(): SinkKind {
  const forced = forcedSink()
  if (forced) return forced
  if (fsAccessSupported()) return 'fs'
  if (!isIOS() && swStreamSupported()) return 'sw'
  if (opfsSupported()) return 'opfs'
  return 'blob'
}

export function createSink(kind: SinkKind): Sink {
  if (kind === 'fs') return new FsAccessSink()
  if (kind === 'sw') return new SwStreamSink()
  if (kind === 'opfs') return new OpfsSink()
  return new BlobSink()
}
