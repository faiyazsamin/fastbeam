import { sanitizeFileName, type FileMeta } from '../protocol'
import type { SavedFile, Sink } from './types'

/** Page ↔ service worker protocol for streamed downloads (see src/sw.ts). */
export const SW_STREAM_PREFIX = '/fb-download/'
export const SW_KEEPALIVE = '/fb-keepalive'
const ACK_WINDOW = 8 * 1024 * 1024

export function swStreamSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller && typeof MessageChannel !== 'undefined'
}

interface Stream {
  port: MessagePort
  frame: HTMLIFrameElement
  unacked: number
  waiters: (() => void)[]
  done: Promise<void>
  resolveDone: () => void
  rejectDone: (e: Error) => void
}

export class SwStreamSink implements Sink {
  readonly kind = 'sw' as const
  readonly destinationLabel = 'saved to Downloads'
  private files: FileMeta[] = []
  private current: Stream | null = null
  private keepalive = 0

  async prepare(files: FileMeta[]): Promise<void> {
    if (!swStreamSupported()) throw new Error('service worker not controlling this page')
    this.files = files
    this.keepalive = window.setInterval(() => void fetch(SW_KEEPALIVE, { cache: 'no-store' }).catch(() => {}), 10_000)
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
      port: port1,
      frame: document.createElement('iframe'),
      unacked: 0,
      waiters: [],
      done,
      resolveDone,
      rejectDone,
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
          if (stream.unacked < ACK_WINDOW) {
            const w = stream.waiters.splice(0)
            for (const fn of w) fn()
          }
        } else if (m.type === 'done') {
          stream.resolveDone()
        } else if (m.type === 'cancelled') {
          stream.rejectDone(new Error('download cancelled'))
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
  }

  async write(_index: number, data: Uint8Array): Promise<void> {
    const s = this.current
    if (!s) throw new Error('no stream')
    const copy = data.slice().buffer
    s.unacked += data.byteLength
    s.port.postMessage({ type: 'chunk', buf: copy }, [copy])
    if (s.unacked >= ACK_WINDOW) {
      await new Promise<void>((resolve) => s.waiters.push(resolve))
    }
  }

  async endFile(_index: number): Promise<void> {
    const s = this.current
    if (!s) return
    s.port.postMessage({ type: 'end' })
    await s.done
    window.setTimeout(() => s.frame.remove(), 15_000)
    s.port.close()
    this.current = null
  }

  async finish(): Promise<SavedFile[]> {
    window.clearInterval(this.keepalive)
    return this.files.map((f) => ({ name: sanitizeFileName(f.name), size: f.size }))
  }

  async abort(): Promise<void> {
    window.clearInterval(this.keepalive)
    const s = this.current
    if (s) {
      s.port.postMessage({ type: 'abort' })
      s.frame.remove()
      s.port.close()
      this.current = null
    }
  }
}
