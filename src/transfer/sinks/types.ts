import type { FileMeta } from '../protocol'

export type SinkKind = 'fs' | 'sw' | 'blob'

export interface SavedFile {
  name: string
  size: number
  /** Open the file in a new tab (File System Access path). */
  open?: () => void | Promise<void>
  /** Trigger the download again (Blob path). */
  save?: () => void
}

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
