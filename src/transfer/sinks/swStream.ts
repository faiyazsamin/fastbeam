import { logger } from '../../state/log'
import { mediaKind } from '../../state/media'
import { sanitizeFileName, type FileMeta } from '../protocol'
import { PREVIEW_MAX_BYTES, PREVIEW_TOTAL_MAX_BYTES, type SavedFile, type Sink } from './types'

/** Page ↔ service worker protocol for streamed downloads (see src/sw.ts). */
export const SW_STREAM_PREFIX = '/fb-download/'
export const SW_KEEPALIVE = '/fb-keepalive'
const ACK_WINDOW = 8 * 1024 * 1024
/** How long to wait for the worker to confirm the last byte before moving on anyway. */
const CLOSE_TIMEOUT_MS = 60_000

const L = logger('sink')

export function swStreamSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller && typeof MessageChannel !== 'undefined'
}

interface Stream {
  name: string
  port: MessagePort
  frame: HTMLIFrameElement
  unacked: number
  waiters: (() => void)[]
  done: Promise<void>
  resolveDone: () => void
  rejectDone: (e: Error) => void
  lastAckAt: number
}

export class SwStreamSink implements Sink {
  readonly kind = 'sw' as const
  readonly destinationLabel = 'saved to Downloads'
  private files: FileMeta[] = []
  private current: Stream | null = null
  private keepalive = 0
  /** Photos and videos under the cap are mirrored in memory so the viewer can show them after the download. */
  private previewParts: (Uint8Array[] | null)[] = []
  private previews: (Blob | null)[] = []
  private previewBudget = PREVIEW_TOTAL_MAX_BYTES

  async prepare(files: FileMeta[]): Promise<void> {
    if (!swStreamSupported()) throw new Error('service worker not controlling this page')
    this.files = files
    this.previews = files.map(() => null)
    this.previewParts = files.map((f) => {
      const keep = !!mediaKind(f.mime, f.name) && f.size <= PREVIEW_MAX_BYTES && f.size <= this.previewBudget
      if (keep) this.previewBudget -= f.size
      return keep ? [] : null
    })
    this.keepalive = window.setInterval(() => void fetch(SW_KEEPALIVE, { cache: 'no-store' }).catch(() => {}), 10_000)
    L.info('streaming to Downloads through the service worker', { files: files.length })
  }

  async startFile(index: number): Promise<void> {
    const meta = this.files[index]!
    const controller = navigator.serviceWorker.controller
    if (!controller) throw new Error('service worker gone')
    const id = crypto.randomUUID()
    const { port1, port2 } = new MessageChannel()
    let resolveDone!: () => void
    let rejectDone!: (e: Error) => void
    const done = new Promise<void>((res, rej) => {
      resolveDone = res
      rejectDone = rej
    })
    const stream: Stream = {
      name: meta.name,
      port: port1,
      frame: document.createElement('iframe'),
      unacked: 0,
      waiters: [],
      done,
      resolveDone,
      rejectDone,
      lastAckAt: Date.now(),
    }
    const ready = new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('service worker did not answer')), 5000)
      port1.onmessage = (e: MessageEvent<{ type: string; bytes?: number }>) => {
        const m = e.data
        if (m.type === 'ready') {
          window.clearTimeout(t)
          resolve()
        } else if (m.type === 'ack') {
          stream.unacked -= m.bytes ?? 0
          stream.lastAckAt = Date.now()
          if (stream.unacked < ACK_WINDOW) {
            const w = stream.waiters.splice(0)
            for (const fn of w) fn()
          }
        } else if (m.type === 'done') {
          stream.resolveDone()
        } else if (m.type === 'cancelled') {
          stream.rejectDone(new Error('download cancelled by the browser'))
        }
      }
    })
    controller.postMessage(
      { type: 'fb-stream', id, name: sanitizeFileName(meta.name), size: meta.size, mime: meta.mime || 'application/octet-stream' },
      [port2],
    )
    await ready
    stream.frame.hidden = true
    stream.frame.src = SW_STREAM_PREFIX + id
    document.body.appendChild(stream.frame)
    this.current = stream
    L.debug(`download started for ${meta.name}`)
  }

  async write(index: number, data: Uint8Array): Promise<void> {
    const s = this.current
    if (!s) throw new Error('no stream')
    this.previewParts[index]?.push(data.slice())
    const copy = data.slice().buffer
    s.unacked += data.byteLength
    s.port.postMessage({ type: 'chunk', buf: copy }, [copy])
    if (s.unacked >= ACK_WINDOW) {
      // The download consumer applies backpressure through acks; a dead consumer must not hang us forever.
      await new Promise<void>((resolve, reject) => {
        s.waiters.push(resolve)
        const t = window.setInterval(() => {
          if (Date.now() - s.lastAckAt > CLOSE_TIMEOUT_MS) {
            window.clearInterval(t)
            reject(new Error('the browser stopped reading the download'))
          }
        }, 5000)
        s.waiters.push(() => window.clearInterval(t))
      })
    }
  }

  async endFile(index: number): Promise<void> {
    const parts = this.previewParts[index]
    if (parts) {
      this.previews[index] = new Blob(parts as BlobPart[], { type: this.files[index]?.mime || 'application/octet-stream' })
      this.previewParts[index] = null
    }
    const s = this.current
    if (!s) return
    s.port.postMessage({ type: 'end' })
    const t0 = Date.now()
    try {
      await Promise.race([
        s.done,
        new Promise<void>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), CLOSE_TIMEOUT_MS)),
      ])
      L.debug(`download handed over for ${s.name} in ${Date.now() - t0} ms`)
    } catch (err) {
      // All bytes were posted; the download either finished without telling us or is still flushing.
      L.warn(`no close confirmation for ${s.name}: ${err instanceof Error ? err.message : String(err)}; continuing`)
    }
    window.setTimeout(() => s.frame.remove(), 15_000)
    s.port.close()
    this.current = null
  }

  async finish(): Promise<SavedFile[]> {
    window.clearInterval(this.keepalive)
    return this.files.map((f, i) => {
      const saved: SavedFile = { name: sanitizeFileName(f.name), size: f.size, type: f.mime }
      const blob = this.previews[i]
      if (blob) saved.blob = async () => blob
      return saved
    })
  }

  async abort(): Promise<void> {
    window.clearInterval(this.keepalive)
    this.previewParts = []
    this.previews = []
    const s = this.current
    if (s) {
      s.port.postMessage({ type: 'abort' })
      s.frame.remove()
      s.port.close()
      this.current = null
    }
  }
}
