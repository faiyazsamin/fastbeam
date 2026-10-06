import { BlobSink } from './blob'
import { FsAccessSink, fsAccessSupported } from './fsAccess'
import { SwStreamSink, swStreamSupported } from './swStream'
import type { Sink, SinkKind } from './types'

export type { SavedFile, Sink, SinkKind } from './types'

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Test hook: `localStorage['fastbeam:sink'] = '"blob"'` forces a sink (headless browsers cannot show pickers). */
function forcedSink(): SinkKind | null {
  try {
    const v = JSON.parse(localStorage.getItem('fastbeam:sink') ?? 'null') as unknown
    return v === 'fs' || v === 'sw' || v === 'blob' ? v : null
  } catch {
    return null
  }
}

/** First sink the browser supports: File System Access → service worker stream → in-memory Blob. */
export function chooseSinkKind(): SinkKind {
  const forced = forcedSink()
  if (forced) return forced
  if (fsAccessSupported()) return 'fs'
  if (!isIOS() && swStreamSupported()) return 'sw'
  return 'blob'
}

export function createSink(kind: SinkKind): Sink {
  if (kind === 'fs') return new FsAccessSink()
  if (kind === 'sw') return new SwStreamSink()
  return new BlobSink()
}
