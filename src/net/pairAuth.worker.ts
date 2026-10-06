/// <reference lib="webworker" />
import { deriveAuthKeyBytes } from './pairAuth'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = async (e: MessageEvent<{ id: string; password: string; code: string }>) => {
  const { id, password, code } = e.data
  try {
    const key = await deriveAuthKeyBytes(password, code)
    const buf = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer
    self.postMessage({ id, key: buf }, [buf])
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
