import { signal, type Signal } from '@preact/signals'
import { BUFFER_HIGH, OFFER_TIMEOUT_MS, SEND_WINDOW, TEXT_MAX } from '../config'
import type { PeerLink } from '../net/peerLink'
import type { Peer } from '../state/peers'
import { SpeedMeter } from './speed'
import {
  encodeChunk,
  newId,
  type DeclineReason,
  type FileMeta,
  type TransferMessage,
} from './protocol'

export type OutgoingState = 'offered' | 'sending' | 'done' | 'declined' | 'busy' | 'timeout' | 'cancelled' | 'failed'

export interface OutgoingFile extends FileMeta {
  sent: number
}

export interface OutgoingSnapshot {
  id: string
  peerId: string
  peerName: string
  state: OutgoingState
  files: OutgoingFile[]
  text: string | null
  totalSize: number
  sentBytes: number
  ackedBytes: number
  speed: number
  etaSeconds: number | null
  startedAt: number | null
  finishedAt: number | null
  cancelledBy: 'sender' | 'receiver' | null
  error: string | null
}

export class OutgoingTransfer {
  readonly id = newId()
  readonly snap: Signal<OutgoingSnapshot>
  private readonly files: File[]
  private readonly metas: FileMeta[]
  private cancelled = false
  private replyResolve: ((m: TransferMessage) => void) | null = null
  private ackWaiters: (() => void)[] = []
  private lowWaiters: (() => void)[] = []
  private acked = 0
  private readonly meter = new SpeedMeter()
  private publishTimer = 0

  constructor(
    readonly peer: Peer,
    readonly link: PeerLink,
    input: { files: File[] } | { text: string },
  ) {
    this.files = 'files' in input ? input.files : []
    this.metas = this.files.map((f) => {
      const m: FileMeta = { fileId: newId(), name: f.name, size: f.size, mime: f.type }
      const rel = relPathOf(f)
      if (rel) m.relPath = rel
      return m
    })
    const text = 'text' in input ? input.text.slice(0, TEXT_MAX) : null
    this.snap = signal<OutgoingSnapshot>({
      id: this.id,
      peerId: peer.deviceId,
      peerName: peer.name,
      state: 'offered',
      files: this.metas.map((m) => ({ ...m, sent: 0 })),
      text,
      totalSize: text !== null ? text.length : this.files.reduce((n, f) => n + f.size, 0),
      sentBytes: 0,
      ackedBytes: 0,
      speed: 0,
      etaSeconds: null,
      startedAt: null,
      finishedAt: null,
      cancelledBy: null,
      error: null,
    })
    link.onBufferedAmountLow = () => {
      const w = this.lowWaiters.splice(0)
      for (const fn of w) fn()
    }
  }

  private patch(p: Partial<OutgoingSnapshot>): void {
    this.snap.value = { ...this.snap.value, ...p }
  }

  /** Throttled progress publication (≤ 10/s). */
  private schedulePublish(): void {
    if (this.publishTimer) return
    this.publishTimer = window.setTimeout(() => {
      this.publishTimer = 0
      const s = this.snap.value
      if (s.state !== 'sending') return
      const speed = this.meter.speed()
      const remaining = s.totalSize - s.sentBytes
      const elapsed = s.startedAt ? Date.now() - s.startedAt : 0
      this.patch({
        files: this.metas.map((m, i) => ({ ...m, sent: this.sentPerFile[i] ?? 0 })),
        speed,
        etaSeconds: elapsed > 2000 && speed > 0 ? remaining / speed : null,
      })
    }, 100)
  }

  private sentPerFile: number[] = []

  async run(): Promise<void> {
    const s = this.snap.value
    const offer: TransferMessage = {
      type: 'offer',
      transferId: this.id,
      totalSize: s.totalSize,
      ...(s.text !== null ? { text: s.text } : { files: this.metas }),
    }
    const reply = new Promise<TransferMessage | 'timeout'>((resolve) => {
      this.replyResolve = resolve
      window.setTimeout(() => resolve('timeout'), OFFER_TIMEOUT_MS + 5000)
    })
    this.link.sendControl(offer)
    const r = await reply
    this.replyResolve = null
    if (this.cancelled) return
    if (r === 'timeout') return this.patch({ state: 'timeout', finishedAt: Date.now() })
    if (r.type === 'decline') {
      const reason: DeclineReason = r.reason
      return this.patch({ state: reason === 'busy' ? 'busy' : reason === 'timeout' ? 'timeout' : 'declined', finishedAt: Date.now() })
    }
    if (r.type !== 'accept') return this.patch({ state: 'failed', error: 'unexpected reply', finishedAt: Date.now() })

    if (s.text !== null) {
      return this.patch({ state: 'done', sentBytes: s.totalSize, ackedBytes: s.totalSize, startedAt: Date.now(), finishedAt: Date.now() })
    }

    this.patch({ state: 'sending', startedAt: Date.now() })
    this.meter.reset()
    try {
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i]!
        const meta = this.metas[i]!
        this.link.sendControl({ type: 'file-start', transferId: this.id, fileId: meta.fileId })
        let bytes = 0
        for await (const chunk of chunksOf(file, this.link.chunkSize)) {
          if (this.cancelled) return
          await this.flowControl()
          if (this.cancelled) return
          this.link.sendChunk(encodeChunk(i, chunk))
          bytes += chunk.byteLength
          this.sentPerFile[i] = bytes
          const total = this.snap.value.sentBytes + chunk.byteLength
          this.snap.value.sentBytes = total // mutate then publish on a throttle
          this.meter.add(chunk.byteLength)
          this.schedulePublish()
        }
        this.link.sendControl({ type: 'file-end', transferId: this.id, fileId: meta.fileId, bytes })
      }
      // Wait for the receiver to confirm the last bytes landed before saying done.
      const t0 = Date.now()
      while (this.acked < this.snap.value.sentBytes && !this.cancelled && Date.now() - t0 < 30_000) {
        await new Promise<void>((resolve) => {
          this.ackWaiters.push(resolve)
          window.setTimeout(resolve, 1000)
        })
      }
      if (this.cancelled) return
      this.link.sendControl({ type: 'done', transferId: this.id })
      window.clearTimeout(this.publishTimer)
      this.publishTimer = 0
      this.patch({
        state: 'done',
        files: this.metas.map((m) => ({ ...m, sent: m.size })),
        sentBytes: this.snap.value.totalSize,
        ackedBytes: this.snap.value.totalSize,
        finishedAt: Date.now(),
        speed: 0,
        etaSeconds: null,
      })
    } catch (err) {
      if (this.cancelled) return
      this.patch({ state: 'failed', error: err instanceof Error ? err.message : String(err), finishedAt: Date.now() })
    }
  }

  private async flowControl(): Promise<void> {
    while (this.link.bufferedAmount > BUFFER_HIGH && !this.cancelled) {
      await new Promise<void>((resolve) => {
        this.lowWaiters.push(resolve)
        window.setTimeout(resolve, 250)
      })
    }
    while (this.snap.value.sentBytes - this.acked > SEND_WINDOW && !this.cancelled) {
      await new Promise<void>((resolve) => {
        this.ackWaiters.push(resolve)
        window.setTimeout(resolve, 500)
      })
    }
  }

  handle(msg: TransferMessage): void {
    if (msg.transferId !== this.id) return
    if (msg.type === 'accept' || msg.type === 'decline') {
      this.replyResolve?.(msg)
      return
    }
    if (msg.type === 'progress') {
      this.acked = Math.max(this.acked, msg.totalReceived)
      this.snap.value.ackedBytes = this.acked
      const w = this.ackWaiters.splice(0)
      for (const fn of w) fn()
      return
    }
    if (msg.type === 'cancel') {
      this.cancelled = true
      this.wake()
      this.patch({ state: 'cancelled', cancelledBy: 'receiver', finishedAt: Date.now() })
    }
  }

  private wake(): void {
    const a = this.ackWaiters.splice(0)
    const b = this.lowWaiters.splice(0)
    for (const fn of [...a, ...b]) fn()
  }

  cancel(): void {
    if (this.cancelled) return
    const s = this.snap.value
    if (s.state !== 'offered' && s.state !== 'sending') return
    this.cancelled = true
    this.wake()
    this.link.sendControl({ type: 'cancel', transferId: this.id, by: 'sender' })
    this.patch({ state: 'cancelled', cancelledBy: 'sender', finishedAt: Date.now() })
  }

  /** The link died mid-transfer. */
  fail(reason: string): void {
    if (this.cancelled) return
    const s = this.snap.value
    if (s.state !== 'offered' && s.state !== 'sending') return
    this.cancelled = true
    this.wake()
    this.patch({ state: 'failed', error: reason, finishedAt: Date.now() })
  }
}

function relPathOf(f: File): string | undefined {
  const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath
  return rel && rel.includes('/') ? rel : undefined
}

/** Read a File as fixed-size chunks without loading it whole. */
async function* chunksOf(file: File, size: number): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader()
  let carry: Uint8Array | null = null
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      let buf: Uint8Array = carry ? concat(carry, value) : value
      carry = null
      let off = 0
      while (buf.byteLength - off >= size) {
        yield buf.subarray(off, off + size)
        off += size
      }
      if (off < buf.byteLength) carry = buf.subarray(off)
      buf = new Uint8Array(0)
    }
    if (carry && carry.byteLength > 0) yield carry
  } finally {
    reader.releaseLock()
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength)
  out.set(a, 0)
  out.set(b, a.byteLength)
  return out
}
