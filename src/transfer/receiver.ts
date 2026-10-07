import { signal, type Signal } from '@preact/signals'
import { BLOB_WARN_BYTES, OFFER_TIMEOUT_MS, PROGRESS_EVERY } from '../config'
import type { PeerLink } from '../net/peerLink'
import { logger } from '../state/log'
import type { Peer } from '../state/peers'

const L = logger('recv')
import { chooseSinkKind, createSink, type SavedFile, type Sink, type SinkKind } from './sinks'
import { SpeedMeter } from './speed'
import { decodeChunk, type DeclineReason, type FileMeta, type OfferMessage, type TransferMessage } from './protocol'

export type IncomingState = 'offered' | 'receiving' | 'done' | 'declined' | 'cancelled' | 'failed'

export interface IncomingFile extends FileMeta {
  received: number
  complete: boolean
}

export interface IncomingSnapshot {
  id: string
  peerId: string
  peerName: string
  state: IncomingState
  files: IncomingFile[]
  text: string | null
  totalSize: number
  receivedBytes: number
  speed: number
  etaSeconds: number | null
  offeredAt: number
  startedAt: number | null
  finishedAt: number | null
  sinkKind: SinkKind
  saved: SavedFile[]
  destinationLabel: string
  cancelledBy: 'sender' | 'receiver' | null
  error: string | null
}

export class IncomingTransfer {
  readonly id: string
  readonly snap: Signal<IncomingSnapshot>
  private sink: Sink | null = null
  private chain: Promise<void> = Promise.resolve()
  private current = -1
  private perFile: number[]
  private lastProgressAt: number[]
  private received = 0
  private closed = false
  private readonly meter = new SpeedMeter()
  private publishTimer = 0
  private readonly offerTimer: number

  constructor(
    readonly peer: Peer,
    readonly link: PeerLink,
    offer: OfferMessage,
    private readonly onSettled: () => void,
  ) {
    this.id = offer.transferId
    const files = (offer.files ?? []).map((f) => ({ ...f, received: 0, complete: false }))
    this.perFile = files.map(() => 0)
    this.lastProgressAt = files.map(() => 0)
    this.snap = signal<IncomingSnapshot>({
      id: this.id,
      peerId: peer.deviceId,
      peerName: peer.name,
      state: 'offered',
      files,
      text: typeof offer.text === 'string' ? offer.text : null,
      totalSize: offer.totalSize,
      receivedBytes: 0,
      speed: 0,
      etaSeconds: null,
      offeredAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      sinkKind: chooseSinkKind(),
      saved: [],
      destinationLabel: '',
      cancelledBy: null,
      error: null,
    })
    this.offerTimer = window.setTimeout(() => {
      if (this.snap.value.state === 'offered') this.decline('timeout')
    }, OFFER_TIMEOUT_MS)
  }

  /** Over 1 GB on the Blob path deserves a warning line in the dialog (build-notes screen 4). */
  get blobWarning(): boolean {
    return this.snap.value.sinkKind === 'blob' && this.snap.value.totalSize > BLOB_WARN_BYTES
  }

  private patch(p: Partial<IncomingSnapshot>): void {
    this.snap.value = { ...this.snap.value, ...p }
  }

  private settle(p: Partial<IncomingSnapshot>): void {
    if (this.closed) return
    this.closed = true
    window.clearTimeout(this.offerTimer)
    window.clearTimeout(this.publishTimer)
    this.patch({ ...p, finishedAt: Date.now(), speed: 0, etaSeconds: null })
    this.onSettled()
  }

  /** Must run inside the Accept click so file pickers can open. */
  async accept(): Promise<void> {
    const s = this.snap.value
    if (s.state !== 'offered') return
    window.clearTimeout(this.offerTimer)
    if (s.text !== null) {
      this.link.sendControl({ type: 'accept', transferId: this.id, fileIds: [] })
      this.settle({ state: 'done', receivedBytes: s.totalSize, startedAt: Date.now() })
      return
    }
    const sink = createSink(s.sinkKind)
    try {
      await sink.prepare(s.files)
    } catch (err) {
      // Picker dismissed or sink unavailable: treat as a decline.
      L.warn(`sink ${s.sinkKind} could not start: ${err instanceof Error ? err.message : String(err)}`)
      this.decline('declined')
      return
    }
    this.sink = sink
    this.meter.reset()
    this.patch({ state: 'receiving', startedAt: Date.now(), destinationLabel: sink.destinationLabel })
    this.link.sendControl({ type: 'accept', transferId: this.id, fileIds: s.files.map((f) => f.fileId) })
  }

  decline(reason: DeclineReason = 'declined'): void {
    if (this.snap.value.state !== 'offered') return
    this.link.sendControl({ type: 'decline', transferId: this.id, reason })
    this.settle({ state: 'declined' })
  }

  cancel(): void {
    const st = this.snap.value.state
    if (st !== 'receiving' && st !== 'offered') return
    this.link.sendControl({ type: 'cancel', transferId: this.id, by: 'receiver' })
    void this.sink?.abort()
    this.settle({ state: 'cancelled', cancelledBy: 'receiver' })
  }

  /** Link lost. */
  fail(reason: string): void {
    const st = this.snap.value.state
    if (st !== 'receiving' && st !== 'offered') return
    void this.sink?.abort()
    this.settle({ state: 'failed', error: reason })
  }

  private enqueue(fn: () => Promise<void>): void {
    this.chain = this.chain.then(fn).catch((err: unknown) => {
      if (!this.closed) {
        L.error(`receive failed: ${err instanceof Error ? err.message : String(err)}`, {
          file: this.snap.value.files[this.current]?.name,
          received: this.received,
        })
        void this.sink?.abort()
        this.link.sendControl({ type: 'cancel', transferId: this.id, by: 'receiver' })
        this.settle({ state: 'failed', error: err instanceof Error ? err.message : String(err) })
      }
    })
  }

  private schedulePublish(): void {
    if (this.publishTimer) return
    this.publishTimer = window.setTimeout(() => {
      this.publishTimer = 0
      const s = this.snap.value
      if (s.state !== 'receiving') return
      const speed = this.meter.speed()
      const remaining = s.totalSize - this.received
      const elapsed = s.startedAt ? Date.now() - s.startedAt : 0
      this.patch({
        receivedBytes: this.received,
        files: s.files.map((f, i) => ({ ...f, received: this.perFile[i] ?? 0 })),
        speed,
        etaSeconds: elapsed > 2000 && speed > 0 ? remaining / speed : null,
      })
    }, 100)
  }

  handle(msg: TransferMessage): void {
    if (msg.transferId !== this.id || this.closed) return
    const s = this.snap.value
    switch (msg.type) {
      case 'file-start': {
        const idx = s.files.findIndex((f) => f.fileId === msg.fileId)
        if (idx < 0) return
        this.enqueue(async () => {
          this.current = idx
          L.debug(`file ${idx + 1}/${s.files.length} starting: ${s.files[idx]?.name}`)
          await this.sink?.startFile(idx)
        })
        return
      }
      case 'file-end': {
        const idx = s.files.findIndex((f) => f.fileId === msg.fileId)
        if (idx < 0) return
        this.enqueue(async () => {
          const got = this.perFile[idx] ?? 0
          L.debug(`file-end for ${s.files[idx]?.name}: ${got}/${msg.bytes} bytes written, closing sink`)
          const t0 = Date.now()
          await this.sink?.endFile(idx)
          L.debug(`sink closed ${s.files[idx]?.name} in ${Date.now() - t0} ms`)
          if (got !== msg.bytes) throw new Error(`size mismatch for ${s.files[idx]?.name}: got ${got}, expected ${msg.bytes}`)
          this.sendProgress(idx, true)
          this.patch({ files: this.snap.value.files.map((f, i) => (i === idx ? { ...f, received: got, complete: true } : f)) })
        })
        return
      }
      case 'done': {
        this.enqueue(async () => {
          L.debug('sender says done, finishing sink')
          const saved = (await this.sink?.finish()) ?? []
          this.settle({
            state: 'done',
            receivedBytes: this.received,
            files: this.snap.value.files.map((f, i) => ({ ...f, received: this.perFile[i] ?? 0, complete: true })),
            saved,
          })
        })
        return
      }
      case 'cancel': {
        void this.sink?.abort()
        this.settle({ state: 'cancelled', cancelledBy: 'sender' })
        return
      }
      default:
        return
    }
  }

  handleChunk(frame: ArrayBuffer): void {
    if (this.closed || this.snap.value.state !== 'receiving') return
    const chunk = decodeChunk(frame)
    if (!chunk) return
    const { fileIndex, data } = chunk
    this.enqueue(async () => {
      if (fileIndex !== this.current) throw new Error('chunk for an unexpected file')
      await this.sink?.write(fileIndex, data)
      this.perFile[fileIndex] = (this.perFile[fileIndex] ?? 0) + data.byteLength
      this.received += data.byteLength
      this.meter.add(data.byteLength)
      if ((this.perFile[fileIndex] ?? 0) - (this.lastProgressAt[fileIndex] ?? 0) >= PROGRESS_EVERY) this.sendProgress(fileIndex)
      this.schedulePublish()
    })
  }

  private sendProgress(fileIndex: number, force = false): void {
    const got = this.perFile[fileIndex] ?? 0
    if (!force && got === this.lastProgressAt[fileIndex]) return
    this.lastProgressAt[fileIndex] = got
    const fileId = this.snap.value.files[fileIndex]?.fileId
    if (!fileId) return
    this.link.sendControl({ type: 'progress', transferId: this.id, fileId, bytesReceived: got, totalReceived: this.received })
  }
}
