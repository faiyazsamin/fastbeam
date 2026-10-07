import type { FileMeta } from '../protocol'

export type SinkKind = 'fs' | 'sw' | 'opfs' | 'blob'

export interface SavedFile {
  name: string
  size: number
  type: string
  /** Open the file in a new tab (File System Access path). */
  open?: () => void | Promise<void>
  /** Trigger the download again (Blob path). */
  save?: () => void
  /** Read the bytes back for the in-app viewer, when the sink still has them. */
  blob?: () => Promise<Blob>
}

/** Media files up to this size are kept in memory on the streaming path so they can be previewed. */
export const PREVIEW_MAX_BYTES = 256 * 1024 * 1024
export const PREVIEW_TOTAL_MAX_BYTES = 512 * 1024 * 1024

/** A destination for received bytes. All methods are called in order on one promise chain. */
export interface Sink {
  readonly kind: SinkKind
  /** Called inside the Accept click so pickers can open. Throws if the user cancels. */
  prepare(files: FileMeta[]): Promise<void>
  startFile(index: number): Promise<void>
  write(index: number, data: Uint8Array): Promise<void>
  endFile(index: number): Promise<void>
  finish(): Promise<SavedFile[]>
  abort(): Promise<void>
  /** Where things end up, for the Done screen ("saved to Downloads"). */
  readonly destinationLabel: string
}
