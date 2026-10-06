/// <reference lib="webworker" />
import jsQR from 'jsqr'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<{ data: ArrayBuffer; width: number; height: number }>) => {
  const { data, width, height } = e.data
  try {
    const result = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'dontInvert' })
    self.postMessage({ text: result?.data ?? null })
  } catch {
    self.postMessage({ text: null })
  }
}
