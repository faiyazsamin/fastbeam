/// <reference lib="webworker" />
/**
 * Writes received chunks straight into the Origin Private File System with synchronous access handles,
 * so a multi-GB file never sits in memory on browsers without a streaming download path (Safari, iOS).
 */
export {}
declare const self: DedicatedWorkerGlobalScope

type SyncHandle = FileSystemSyncAccessHandle

type In =
  | { type: 'probe' }
  | { type: 'open'; index: number; path: string }
  | { type: 'write'; index: number; buf: ArrayBuffer }
  | { type: 'close'; index: number }
  | { type: 'abort' }

const DIR = 'fastbeam-incoming'
const handles = new Map<number, { h: SyncHandle; offset: number; path: string }>()

async function dir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(DIR, { create: true })
}

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data
  try {
    if (m.type === 'probe') {
      const d = await dir()
      const fh = await d.getFileHandle('.probe', { create: true })
      if (typeof fh.createSyncAccessHandle !== 'function') throw new Error('no sync access handles')
      const h = await fh.createSyncAccessHandle()
      h.close()
      await d.removeEntry('.probe')
      self.postMessage({ type: 'ready' })
      return
    }
    if (m.type === 'open') {
      const d = await dir()
      const fh = await d.getFileHandle(m.path, { create: true })
      const h = await fh.createSyncAccessHandle()
      h.truncate(0)
      handles.set(m.index, { h, offset: 0, path: m.path })
      self.postMessage({ type: 'opened', index: m.index })
      return
    }
    if (m.type === 'write') {
      const entry = handles.get(m.index)
      if (!entry) throw new Error('write before open')
      const n = entry.h.write(m.buf, { at: entry.offset })
      entry.offset += n
      self.postMessage({ type: 'ack', index: m.index, bytes: m.buf.byteLength })
      return
    }
    if (m.type === 'close') {
      const entry = handles.get(m.index)
      if (entry) {
        entry.h.flush()
        entry.h.close()
        handles.delete(m.index)
      }
      self.postMessage({ type: 'closed', index: m.index, bytes: entry?.offset ?? 0 })
      return
    }
    if (m.type === 'abort') {
      const d = await dir()
      for (const [, entry] of handles) {
        try {
          entry.h.close()
          await d.removeEntry(entry.path)
        } catch {
          /* best effort */
        }
      }
      handles.clear()
      self.postMessage({ type: 'aborted' })
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
